import type { Player, PlayerId, Team } from '../../data/types'
import type { Rng } from '../../engine/rng'
import { pickDistinct } from './draftPool'

export type HouseRuleId = 'youth-movement' | 'short-bench'

export interface HouseRule {
  id: HouseRuleId
  label: string
  description: string
}

const YOUTH_MOVEMENT_MAX_AGE = 22
const YOUTH_MOVEMENT_MIN_STARTERS = 2
const SHORT_BENCH_ROSTER_SIZE = 8

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

export interface ApplyHouseRuleResult {
  team: Team
  players: Player[]
}

/** `players` is the full league roster pool; only the given team's players are read/mutated. */
export function applyHouseRule(ruleId: HouseRuleId, team: Team, players: Player[]): ApplyHouseRuleResult {
  const roster = players.filter((p) => p.teamId === team.id)

  if (ruleId === 'youth-movement') {
    return { team: applyYouthMovement(team, roster), players }
  }

  const { team: updatedTeam, cutPlayerIds } = applyShortBench(team, roster)
  const updatedPlayers = players.map((p) => (cutPlayerIds.has(p.id) ? { ...p, teamId: null } : p))
  return { team: updatedTeam, players: updatedPlayers }
}

/** Rolls `count` distinct candidates for the run-start house-rule draft (Section 8.2). */
export function pickRandomHouseRules(count: number, rng: Rng): HouseRuleId[] {
  return pickDistinct(Object.keys(HOUSE_RULES) as HouseRuleId[], count, rng)
}
