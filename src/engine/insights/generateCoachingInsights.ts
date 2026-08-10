import { DEFENSIVE_SCHEMES } from '../../data/presets'
import type { GameId, PlayCallType, Player, PlayerId, PossessionLogEntry, Team, TeamId } from '../../data/types'
import {
  FATIGUE_EMERGENCY_THRESHOLD,
  FATIGUE_SUB_OUT_THRESHOLD,
  INSIGHT_MAX_FATIGUE_EVENTS,
  INSIGHT_WEAK_LINK_MIN_TARGETING_COUNT,
  OVERTIME_SECONDS,
  PERIOD_SECONDS,
  REGULATION_PERIODS,
} from '../constants'
import { worstInteriorDefender, worstPerimeterDefender } from '../possession/playerSelector'
import { tickFatigue } from '../rotation/fatigue'
import { chartedPlayerId } from '../rotation/rotationPlan'
import type { RotationState } from '../rotation/rotationState'
import { getPeriodLabel } from '../simulateGame'

/**
 * What an insight is *about*, so callers can tell them apart without matching on prose.
 *
 * The distinction that matters: the first two describe a standing problem with the team or the
 * GM's instructions, and tend to recur game after game until something changes. The third is
 * routine rotation management -- worth surfacing at a checkpoint, not worth remembering for the
 * length of a run. run/runInsights.ts is the consumer that cares.
 */
export type CoachingInsightKind =
  /** The opponent found the weakest defender on the floor and kept going at him. */
  | 'weak-link-targeting'
  /** A charted player was pulled anyway, because fatigue hit the emergency threshold. The GM's
   *  explicit instruction lost to the coach heuristic. */
  | 'chart-override'
  /** An ordinary fatigue substitution -- the rotation working as intended. */
  | 'fatigue-substitution'

export interface CoachingInsight {
  text: string
  /** Which team this insight is about -- lets a caller (Section 9's chunk checkpoints) filter
   *  down to just the user's own team rather than showing observations about the AI opponent. */
  teamId: TeamId
  kind: CoachingInsightKind
  /**
   * The player the observation is *about* -- the defender being hunted, or the player pulled.
   *
   * Carried structurally rather than left implicit in `text`, because the text embeds per-game
   * specifics ("62 possessions this game, allowing 57 points") and so differs every time even when
   * the underlying problem is identical. Anything asking "is this the same problem recurring?"
   * -- run/runInsights.ts -- has to compare something stabler than the prose.
   */
  subjectId: PlayerId
  /** Denormalised so a consumer that outlives the roster lookup can still name them. */
  subjectName: string
  /**
   * Which game produced this observation. Stamped by run/resolveGame.ts rather than here -- the
   * generator is handed a possession log and has no idea which fixture it belongs to.
   *
   * Needed because the stretch screen shows a game's own insights next to its box score, and
   * `pendingChunkInsights` is otherwise a flat list with nothing to attribute a line to. Optional
   * for saves written before it existed; those insights simply can't be filed under a game, which
   * the stretch screen handles by showing nothing rather than showing them under the wrong one.
   */
  gameId?: GameId
  /**
   * The evidence behind the prose, kept as numbers so several games' worth of the same observation
   * can be *added up* rather than listed one line at a time (run/chunkInsightSummary.ts).
   *
   * Only weak-link targeting carries any -- a fatigue substitution is an event, not a measurement,
   * and counting how many times it happened is the whole of what there is to say about it.
   *
   * Optional because it arrived after saves existed: a run stored before this field simply has an
   * insight with no numbers to sum, which the summary handles by omitting the numeric clause.
   */
  metrics?: {
    possessionsTargeted: number
    pointsAllowed: number
  }
}

function resolvePlayer(id: PlayerId, playersById: Map<PlayerId, Player>): Player {
  const player = playersById.get(id)
  if (!player) throw new Error(`Player ${id} referenced in the possession log was not found`)
  return player
}

/**
 * Which defender a weak-link-sensitive scheme (Switch-Everything) would assign for this possession
 * -- mirrors playerSelector.ts's own weakLinkSensitive branches exactly, so this is a faithful
 * post-hoc reconstruction, not a new/different rule. Transition is scheme-agnostic there too, so
 * it's skipped here (null).
 */
function weakLinkDefenderFor(
  playCallUsed: PlayCallType,
  primaryPlayerId: PlayerId,
  defense: Player[],
  playersById: Map<PlayerId, Player>,
): Player | null {
  switch (playCallUsed) {
    case 'post-up':
      return worstInteriorDefender(defense)
    case 'spot-up':
    case 'cutting':
    case 'pick-and-roll':
      return worstPerimeterDefender(defense)
    case 'isolation': {
      const primary = resolvePlayer(primaryPlayerId, playersById)
      return primary.attributes.outsideShot > primary.attributes.insideShot
        ? worstPerimeterDefender(defense)
        : worstInteriorDefender(defense)
    }
    case 'transition':
      return null
  }
}

/**
 * Detects a single defender getting disproportionately targeted while their team ran a weak-link-
 * sensitive scheme (e.g. Switch-Everything) -- reconstructed entirely from possessionLog + static
 * player attributes, since defender assignment for these schemes has no rng/hidden-state dependency.
 */
function detectWeakLinkTargeting(
  defendingTeam: Team,
  defendingTeamIsHome: boolean,
  opponentTeamId: TeamId,
  possessionLog: PossessionLogEntry[],
  playersById: Map<PlayerId, Player>,
): CoachingInsight | null {
  // Read per possession rather than once off the team, because a GM can switch schemes mid-game
  // from the simcast: the team's stored value is only where they ended up, so judging the whole
  // game by it would credit (or blame) possessions that were defended some other way. Falling back
  // to the team's scheme covers games logged before the field existed, where it is exactly right.
  const schemeFor = (entry: PossessionLogEntry) =>
    DEFENSIVE_SCHEMES[entry.defenseSchemeId ?? defendingTeam.defensiveStrategyId] ?? DEFENSIVE_SCHEMES[defendingTeam.defensiveStrategyId]

  const tally = new Map<PlayerId, { count: number; pointsAllowed: number }>()
  // Which scheme the hunted possessions were actually run under, for the prose. A game switched
  // part-way names the one that was up when it was last exploited, which is the one still worth
  // telling the GM about.
  let exploitedSchemeName = DEFENSIVE_SCHEMES[defendingTeam.defensiveStrategyId]?.name ?? 'Your defense'

  for (const entry of possessionLog) {
    if (entry.offenseTeamId !== opponentTeamId) continue
    // Only possessions actually defended with a weak-link-sensitive scheme can have been hunted
    // this way -- the rest were played with the assigned matchup and belong to no one.
    const scheme = schemeFor(entry)
    if (!scheme.weakLinkSensitive) continue
    exploitedSchemeName = scheme.name
    const defenseFive = defendingTeamIsHome ? entry.homeOnCourt : entry.awayOnCourt
    const defense = defenseFive.map(({ playerId }) => resolvePlayer(playerId, playersById))
    const defender = weakLinkDefenderFor(entry.playCallUsed, entry.primaryPlayerId, defense, playersById)
    if (!defender) continue

    const current = tally.get(defender.id) ?? { count: 0, pointsAllowed: 0 }
    current.count += 1
    if (entry.outcome === 'make') current.pointsAllowed += entry.pointsScored
    tally.set(defender.id, current)
  }

  let topId: PlayerId | null = null
  let top = { count: 0, pointsAllowed: 0 }
  for (const [id, stats] of tally) {
    if (stats.count > top.count) {
      topId = id
      top = stats
    }
  }
  if (!topId || top.count < INSIGHT_WEAK_LINK_MIN_TARGETING_COUNT) return null

  const defenderName = resolvePlayer(topId, playersById).name
  const possessionWord = top.count === 1 ? 'possession' : 'possessions'
  return {
    teamId: defendingTeam.id,
    kind: 'weak-link-targeting',
    subjectId: topId,
    subjectName: defenderName,
    metrics: { possessionsTargeted: top.count, pointsAllowed: top.pointsAllowed },
    text: `${exploitedSchemeName} defense got picked on: ${defenderName} was matched up on ${top.count} ${possessionWord} this game, allowing ${top.pointsAllowed} points.`,
  }
}

interface FatigueSubEvent {
  possessionNumber: number
  /** Read straight off the log rather than re-derived from the possession index. */
  period: number
  outPlayerId: PlayerId
  inPlayerId: PlayerId
  reason: 'emergency' | 'fatigue'
  teamId: TeamId
  /** True when the outgoing player was actually charted into this slot at the moment they were
   *  pulled (rotation-charts.md Phase H) -- i.e. this wasn't just the ordinary fatigue/pace
   *  heuristic doing its job, it's the deviation rule overriding the GM's own chart because the
   *  charted player was genuinely exhausted. */
  wasChartedDeviation: boolean
}

/** Seconds elapsed into a period is measured against that period's own length -- regulation and
 *  overtime periods aren't the same length, so getting this wrong would misjudge every charted
 *  lookup once a game reaches overtime. */
function periodLengthSeconds(period: number): number {
  return period <= REGULATION_PERIODS ? PERIOD_SECONDS : OVERTIME_SECONDS
}

/**
 * Replays tickFatigue possession-by-possession against the log's own on-court lists to reproduce
 * the exact fatigue trajectory the live sim had (fatigue is a deterministic function of on-court
 * history + static durability, so no engine-side logging is needed to recover it), then flags any
 * on-court departure that happened while the outgoing player's reconstructed fatigue was at or
 * above the sub-out threshold.
 */
function detectFatigueSubstitutionEvents(
  team: Team,
  teamIsHome: boolean,
  possessionLog: PossessionLogEntry[],
  playersById: Map<PlayerId, Player>,
): FatigueSubEvent[] {
  const roster = team.rosterPlayerIds.map((id) => resolvePlayer(id, playersById))
  const state: RotationState = {
    onCourt: [],
    fatigue: new Map(team.rosterPlayerIds.map((id) => [id, 0])),
    secondsPlayed: new Map(team.rosterPlayerIds.map((id) => [id, 0])),
    shiftEnteredAtSeconds: new Map(),
  }

  const events: FatigueSubEvent[] = []

  for (let i = 0; i < possessionLog.length; i++) {
    const entry = possessionLog[i]
    const onCourt = teamIsHome ? entry.homeOnCourt : entry.awayOnCourt
    // Slots come straight off the log now, so the replay reproduces the assignment the live sim
    // actually used rather than guessing it from each player's listed position.
    state.onCourt = onCourt.map(({ playerId, slot }) => ({ player: resolvePlayer(playerId, playersById), slot }))
    // The log's own duration, so the replay tracks the live sim exactly -- fatigue is time-based
    // now, and assuming a fixed slice per possession would drift from the real trajectory.
    tickFatigue(state, roster, entry.durationSeconds)

    const next = possessionLog[i + 1]
    if (!next) continue
    const onCourtIds = onCourt.map((o) => o.playerId)
    const nextOnCourtIds = (teamIsHome ? next.homeOnCourt : next.awayOnCourt).map((o) => o.playerId)
    const nextSet = new Set(nextOnCourtIds)
    const onCourtSet = new Set(onCourtIds)

    const outIds = onCourtIds.filter((id) => !nextSet.has(id))
    const inIds = nextOnCourtIds.filter((id) => !onCourtSet.has(id))

    // The moment the substitution decision for `next` was made -- same period-relative clock
    // simulateGame.ts's checkSubstitutions itself used -- so a chart lookup here matches exactly
    // what the live sim would have consulted.
    const secondsIntoPeriodAtSub = next.period === entry.period ? periodLengthSeconds(entry.period) - entry.clockSecondsRemaining : 0

    outIds.forEach((outId, idx) => {
      const fatigueLevel = state.fatigue.get(outId) ?? 0
      if (fatigueLevel < FATIGUE_SUB_OUT_THRESHOLD) return
      const isEmergency = fatigueLevel >= FATIGUE_EMERGENCY_THRESHOLD
      const outSlot = onCourt.find((o) => o.playerId === outId)?.slot
      const wasChartedDeviation =
        isEmergency && outSlot !== undefined && chartedPlayerId(team.rotationPlan, next.period, outSlot, secondsIntoPeriodAtSub) === outId

      events.push({
        possessionNumber: entry.possessionNumber,
        period: entry.period,
        outPlayerId: outId,
        inPlayerId: inIds[idx] ?? outId,
        reason: isEmergency ? 'emergency' : 'fatigue',
        teamId: team.id,
        wasChartedDeviation,
      })
    })
  }

  return events
}

export function generateCoachingInsights(
  possessionLog: PossessionLogEntry[],
  homeTeam: Team,
  awayTeam: Team,
  playersById: Map<PlayerId, Player>,
): CoachingInsight[] {
  const insights: CoachingInsight[] = []

  const homeMatchupInsight = detectWeakLinkTargeting(homeTeam, true, awayTeam.id, possessionLog, playersById)
  if (homeMatchupInsight) insights.push(homeMatchupInsight)
  const awayMatchupInsight = detectWeakLinkTargeting(awayTeam, false, homeTeam.id, possessionLog, playersById)
  if (awayMatchupInsight) insights.push(awayMatchupInsight)

  const fatigueEvents = [
    ...detectFatigueSubstitutionEvents(homeTeam, true, possessionLog, playersById),
    ...detectFatigueSubstitutionEvents(awayTeam, false, possessionLog, playersById),
  ]

  const selectedFatigueEvents = [...fatigueEvents]
    .sort((a, b) => {
      if (a.reason !== b.reason) return a.reason === 'emergency' ? -1 : 1
      return b.possessionNumber - a.possessionNumber
    })
    .slice(0, INSIGHT_MAX_FATIGUE_EVENTS)
    .sort((a, b) => a.possessionNumber - b.possessionNumber)

  for (const event of selectedFatigueEvents) {
    const outName = resolvePlayer(event.outPlayerId, playersById).name
    const inName = resolvePlayer(event.inPlayerId, playersById).name
    const period = getPeriodLabel(event.period)
    const text = event.wasChartedDeviation
      ? `${outName} was charted to stay on the floor but got pulled with emergency fatigue in the ${period} -- ${inName} covered instead.`
      : `${outName} was pulled with heavy fatigue in the ${period}, ${inName} checked in.`
    insights.push({
      teamId: event.teamId,
      kind: event.wasChartedDeviation ? 'chart-override' : 'fatigue-substitution',
      subjectId: event.outPlayerId,
      subjectName: outName,
      text,
    })
  }

  return insights
}
