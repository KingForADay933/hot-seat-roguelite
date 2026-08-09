import type { Player, PlayerId, Team } from '../../data/types'
import { shiftPlayerAttributes } from '../../engine/attributeShift'
import type { Rng } from '../../engine/rng'
import { pickDistinct } from './draftPool'

export type HouseRuleId = 'youth-movement' | 'short-bench' | 'minutes-cap' | 'deep-bench' | 'homegrown-mandate'

export interface HouseRule {
  id: HouseRuleId
  label: string
  description: string
}

const YOUTH_MOVEMENT_MAX_AGE = 22
const YOUTH_MOVEMENT_MIN_STARTERS = 2
const SHORT_BENCH_ROSTER_SIZE = 8

/**
 * The most any one player may be given per game under Minutes Cap.
 *
 * Safe at every position because generated rosters carry at least two players per position
 * (engine/generator/randomTeam.ts's ROSTER_TEMPLATE), so a position's REGULATION_MINUTES is still
 * coverable at 2 x 30 = 60. It bites on concentration rather than on the generated defaults: the
 * depth weights already hand a lone starter about 32, so the rule costs him two minutes and takes
 * away the option of simply riding the best player at a position for the whole game.
 */
const MINUTES_CAP = 30

/** How many of the worst players Deep Bench pushes down to replacement level, and by how much.
 *  Sized to sit clearly below a usable rotation player without bottoming out the attribute floor. */
const DEEP_BENCH_THIN_COUNT = 4
const DEEP_BENCH_PENALTY = 16

/**
 * How many players Homegrown Mandate protects, and the minutes each must keep.
 *
 * Two at 20 is deliberately satisfiable in the worst case: if both land at the same position they
 * need 40 of that position's 48, which still leaves the group inside its budget rather than forcing
 * an unresolvable conflict between this floor and the per-position ceiling.
 */
const HOMEGROWN_PROTECTED_COUNT = 2
export const HOMEGROWN_MIN_MINUTES = 20

export const HOUSE_RULES: Record<HouseRuleId, HouseRule> = {
  'youth-movement': {
    id: 'youth-movement',
    label: 'Youth Movement',
    description: `At least ${YOUTH_MOVEMENT_MIN_STARTERS} starters must be ${YOUTH_MOVEMENT_MAX_AGE} or younger.`,
  },
  'short-bench': {
    id: 'short-bench',
    label: 'Short Bench',
    description: `Roster trimmed to ${SHORT_BENCH_ROSTER_SIZE} -- your starters plus a thin bench, nowhere to hide from fatigue.`,
  },
  'minutes-cap': {
    id: 'minutes-cap',
    label: 'Minutes Cap',
    description: `No player may be given more than ${MINUTES_CAP} minutes a game -- your best man cannot simply play the whole night.`,
  },
  'deep-bench': {
    id: 'deep-bench',
    label: 'Deep Bench, Thin Talent',
    description: `A full roster, but your last ${DEEP_BENCH_THIN_COUNT} are replacement level -- somebody still has to cover those minutes.`,
  },
  'homegrown-mandate': {
    id: 'homegrown-mandate',
    label: 'Homegrown Mandate',
    description: `Your ${HOMEGROWN_PROTECTED_COUNT} best players must stay in the rotation, ${HOMEGROWN_MIN_MINUTES} minutes a game minimum.`,
  },
}

/** The per-player minutes ceiling this rule imposes, or null when it imposes none. Read by
 *  run/minutesBudget.ts, which folds it into the per-position budget so the two limits are applied
 *  in one place rather than each being checked separately at every call site. */
export function houseRuleMinutesCap(ruleId: HouseRuleId): number | null {
  return ruleId === 'minutes-cap' ? MINUTES_CAP : null
}

/**
 * The players a rule pins into the rotation, by id -- empty for every rule that pins nobody.
 *
 * Derived from the roster on every read rather than stored at draft time, which keeps the rule
 * working without adding a field to RunState. The cost is that the protected pair can shift if
 * development or a shop camp reorders the roster's top two; that is the honest reading of "your two
 * best players" anyway, and with no trades or free agency in the game there is nothing else that
 * could move them.
 */
export function houseRuleProtectedPlayerIds(ruleId: HouseRuleId, roster: Player[]): Set<PlayerId> {
  if (ruleId !== 'homegrown-mandate') return new Set()
  // Ties broken by id so the protected pair is stable across reads rather than depending on the
  // order the roster happens to arrive in.
  const ranked = [...roster].sort((a, b) => b.overallRating - a.overallRating || a.id.localeCompare(b.id))
  return new Set(ranked.slice(0, HOMEGROWN_PROTECTED_COUNT).map((p) => p.id))
}

/** The minutes floor this rule holds a given player to -- 0 for anyone it doesn't protect. */
export function houseRuleMinMinutesFor(ruleId: HouseRuleId, roster: Player[], playerId: PlayerId): number {
  return houseRuleProtectedPlayerIds(ruleId, roster).has(playerId) ? HOMEGROWN_MIN_MINUTES : 0
}

/**
 * Swaps in the best available under-22 player at the same position for each old starter, until at
 * least YOUTH_MOVEMENT_MIN_STARTERS qualify or eligible candidates run out. Position-matched only
 * -- generateTeam builds startingFive as exactly one player per position, and buildMatchups/
 * findAtPosition (engine/matchup.ts) depend on that holding for every on-court five, so a
 * cross-position swap would silently break matchup assignment and per-position substitution.
 */
function applyYouthMovement(team: Team, roster: Player[]): Team {
  const byId = new Map(roster.map((p) => [p.id, p]))
  const startingFive = team.startingFive.map((id) => byId.get(id)).filter((p): p is Player => p !== undefined)

  const youngStarterCount = startingFive.filter((p) => p.age <= YOUTH_MOVEMENT_MAX_AGE).length
  if (youngStarterCount >= YOUTH_MOVEMENT_MIN_STARTERS) return team

  const startingIds = new Set(startingFive.map((p) => p.id))
  const youngBenchByPosition = new Map<string, Player>()
  for (const p of roster) {
    if (startingIds.has(p.id) || p.age > YOUTH_MOVEMENT_MAX_AGE) continue
    const existing = youngBenchByPosition.get(p.positions[0])
    if (!existing || p.overallRating > existing.overallRating) youngBenchByPosition.set(p.positions[0], p)
  }

  const nextFive = [...startingFive]
  let needed = YOUTH_MOVEMENT_MIN_STARTERS - youngStarterCount

  for (let i = 0; i < nextFive.length && needed > 0; i++) {
    const starter = nextFive[i]
    if (starter.age <= YOUTH_MOVEMENT_MAX_AGE) continue
    const candidate = youngBenchByPosition.get(starter.positions[0])
    if (!candidate) continue
    nextFive[i] = candidate
    needed -= 1
  }

  return { ...team, startingFive: nextFive.map((p) => p.id) }
}

/** Cuts the roster down to starters + the best remaining bench players, waiving the rest (teamId
 *  set to null, same free-agent semantics the rest of the engine already uses). */
function applyShortBench(team: Team, roster: Player[]): { team: Team; cutPlayerIds: Set<PlayerId> } {
  if (roster.length <= SHORT_BENCH_ROSTER_SIZE) return { team, cutPlayerIds: new Set() }

  const startingIds = new Set(team.startingFive)
  const bench = roster.filter((p) => !startingIds.has(p.id)).sort((a, b) => b.overallRating - a.overallRating)
  const keptBench = bench.slice(0, SHORT_BENCH_ROSTER_SIZE - startingIds.size)
  const keptIds = new Set([...startingIds, ...keptBench.map((p) => p.id)])
  const cutPlayerIds = new Set(roster.filter((p) => !keptIds.has(p.id)).map((p) => p.id))

  return {
    team: {
      ...team,
      maxRosterSize: SHORT_BENCH_ROSTER_SIZE,
      rosterPlayerIds: team.rosterPlayerIds.filter((id) => keptIds.has(id)),
      rotationMinutes: Object.fromEntries(Object.entries(team.rotationMinutes).filter(([id]) => keptIds.has(id))),
    },
    cutPlayerIds,
  }
}

/** Brings the generated targets under the cap up front, so the rule is already true of the roster
 *  the GM is first shown rather than only of edits they make afterwards. Purely a reduction --
 *  minutes freed here are left unassigned, since handing them to someone else is the allocation
 *  decision the rule exists to make the GM face. */
function applyMinutesCap(team: Team): Team {
  const rotationMinutes = Object.fromEntries(
    Object.entries(team.rotationMinutes).map(([id, minutes]) => [id, Math.min(minutes, MINUTES_CAP)]),
  )
  return { ...team, rotationMinutes }
}

/** Drops the worst DEEP_BENCH_THIN_COUNT players to replacement level, leaving the roster full.
 *  The inverse pressure to Short Bench: bodies are available, but leaning on them costs real
 *  quality, so resting a starter stops being free. */
function applyDeepBench(roster: Player[]): Map<PlayerId, Player> {
  const ranked = [...roster].sort((a, b) => a.overallRating - b.overallRating || a.id.localeCompare(b.id))
  return new Map(ranked.slice(0, DEEP_BENCH_THIN_COUNT).map((p) => [p.id, shiftPlayerAttributes(p, -DEEP_BENCH_PENALTY)]))
}

/**
 * Seeds the protected players at their floor, taking any shortfall from their own positional
 * teammates so the position stays inside its budget.
 *
 * Rarely does anything at draft time -- the protected pair are the roster's two best, and the depth
 * weights already give the top man at a position about 32 -- but it keeps the invariant true from
 * the first screen rather than relying on the GM never having been shown a violating roster.
 */
function applyHomegrownMandate(team: Team, roster: Player[]): Team {
  const protectedIds = houseRuleProtectedPlayerIds('homegrown-mandate', roster)
  const rotationMinutes = { ...team.rotationMinutes }
  const byId = new Map(roster.map((p) => [p.id, p]))

  for (const playerId of protectedIds) {
    const player = byId.get(playerId)
    if (!player) continue
    const shortfall = HOMEGROWN_MIN_MINUTES - (rotationMinutes[playerId] ?? 0)
    if (shortfall <= 0) continue
    rotationMinutes[playerId] = HOMEGROWN_MIN_MINUTES

    // Paid for from the deepest bench upward, so the minutes come off whoever was playing least at
    // that position rather than off the rotation player the GM is relying on.
    //
    // The other protected player is a donor too, down to his own floor and no further. Excluding him
    // outright is what a first cut did, and it left a position holding both protected players with
    // nowhere to find the shortfall -- the group went over its 48 and the ceiling it implies crossed
    // below the floor this rule sets, which is precisely the conflict minMinutesFor promises cannot
    // happen. Two protected players need 40 of a position's 48, so there is always enough to go round.
    let owed = shortfall
    const teammates = roster
      .filter((p) => p.id !== playerId && p.positions[0] === player.positions[0])
      .sort((a, b) => (rotationMinutes[a.id] ?? 0) - (rotationMinutes[b.id] ?? 0))
    for (const teammate of teammates) {
      if (owed <= 0) break
      const teammateFloor = protectedIds.has(teammate.id) ? HOMEGROWN_MIN_MINUTES : 0
      const taken = Math.min(owed, Math.max((rotationMinutes[teammate.id] ?? 0) - teammateFloor, 0))
      rotationMinutes[teammate.id] = (rotationMinutes[teammate.id] ?? 0) - taken
      owed -= taken
    }
  }

  return { ...team, rotationMinutes }
}

export interface ApplyHouseRuleResult {
  team: Team
  players: Player[]
}

/** `players` is the full league roster pool; only the given team's players are read/mutated. */
export function applyHouseRule(ruleId: HouseRuleId, team: Team, players: Player[]): ApplyHouseRuleResult {
  const roster = players.filter((p) => p.teamId === team.id)

  switch (ruleId) {
    case 'youth-movement':
      return { team: applyYouthMovement(team, roster), players }
    case 'minutes-cap':
      return { team: applyMinutesCap(team), players }
    case 'homegrown-mandate':
      return { team: applyHomegrownMandate(team, roster), players }
    case 'deep-bench': {
      const thinned = applyDeepBench(roster)
      return { team, players: players.map((p) => thinned.get(p.id) ?? p) }
    }
    case 'short-bench': {
      const { team: updatedTeam, cutPlayerIds } = applyShortBench(team, roster)
      return { team: updatedTeam, players: players.map((p) => (cutPlayerIds.has(p.id) ? { ...p, teamId: null } : p)) }
    }
  }
}

/** Rolls `count` distinct candidates for the run-start house-rule draft (Section 8.2). */
export function pickRandomHouseRules(count: number, rng: Rng): HouseRuleId[] {
  return pickDistinct(Object.keys(HOUSE_RULES) as HouseRuleId[], count, rng)
}
