import { DEFENSIVE_SCHEMES } from '../../data/presets'
import type { PlayCallType, Player, PlayerId, PossessionLogEntry, Team, TeamId } from '../../data/types'
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

export interface CoachingInsight {
  text: string
  /** Which team this insight is about -- lets a caller (Section 9's chunk checkpoints) filter
   *  down to just the user's own team rather than showing observations about the AI opponent. */
  teamId: TeamId
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
  const scheme = DEFENSIVE_SCHEMES[defendingTeam.defensiveStrategyId]
  if (!scheme.weakLinkSensitive) return null

  const tally = new Map<PlayerId, { count: number; pointsAllowed: number }>()

  for (const entry of possessionLog) {
    if (entry.offenseTeamId !== opponentTeamId) continue
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
    text: `${scheme.name} defense got picked on: ${defenderName} was matched up on ${top.count} ${possessionWord} this game, allowing ${top.pointsAllowed} points.`,
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
    insights.push({ teamId: event.teamId, text })
  }

  return insights
}
