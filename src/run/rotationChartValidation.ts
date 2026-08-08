import type { Player, PlayerId, Position, Team } from '../data/types'
import { PERIOD_SECONDS } from '../engine/constants'
import { clamp } from '../engine/math'
import { POSITION_ORDER } from '../engine/matchup'
import { slotSlideDistance } from '../engine/positionFit'
import { fatigueGainPerSecond, fatigueRecoveryPerSecond } from '../engine/rotation/fatigue'
import { CHARTABLE_PERIODS, getSegments } from './rotationChart'

/** Live-validation reads on a rotation chart (rotation-charts.md Phase G): what a GM sees while
 *  charting, not anything the engine itself checks -- Phase F's checkSubstitutions trusts the plan
 *  it's handed, so surfacing problems here is what makes that trust safe. */

interface ChartedSpan {
  startSeconds: number
  endSeconds: number
  slot: Position
}

function chartedSpansInPeriod(team: Team, period: number, playerId: PlayerId): ChartedSpan[] {
  const spans: ChartedSpan[] = []
  for (const slot of POSITION_ORDER) {
    for (const segment of getSegments(team.rotationPlan, period, slot)) {
      if (segment.fill.kind === 'player' && segment.fill.playerId === playerId) {
        spans.push({ startSeconds: segment.startSeconds, endSeconds: segment.endSeconds, slot })
      }
    }
  }
  return spans.sort((a, b) => a.startSeconds - b.startSeconds)
}

/** Every playerId named anywhere in the plan. */
function chartedPlayerIds(team: Team): PlayerId[] {
  const ids = new Set<PlayerId>()
  for (const period of CHARTABLE_PERIODS) {
    for (const slot of POSITION_ORDER) {
      for (const segment of getSegments(team.rotationPlan, period, slot)) {
        if (segment.fill.kind === 'player') ids.add(segment.fill.playerId)
      }
    }
  }
  return [...ids]
}

/**
 * Charted minutes per player, summed across every segment that names them. Auto spans contribute
 * nothing -- nobody's actually assigned to them, and the real fatigue/pace heuristic's choice for
 * that time can't be known until the game is simulated (Section 8's open question on whether the
 * chart should feed synergy/usage continuously turns on this same gap).
 */
export function chartedMinutesByPlayer(team: Team): Map<PlayerId, number> {
  const minutes = new Map<PlayerId, number>()
  for (const playerId of chartedPlayerIds(team)) {
    let seconds = 0
    for (const period of CHARTABLE_PERIODS) {
      for (const span of chartedSpansInPeriod(team, period, playerId)) seconds += span.endSeconds - span.startSeconds
    }
    minutes.set(playerId, seconds / 60)
  }
  return minutes
}

export interface DoubleBookedConflict {
  period: number
  playerId: PlayerId
  slots: [Position, Position]
  overlapStartSeconds: number
  overlapEndSeconds: number
}

/**
 * Each slot's timeline is edited independently, so nothing stops a GM from naming the same player
 * in two slots at once -- a plan shape checkSubstitutions was never asked to resolve (it trusts the
 * plan it's handed). Surfacing every overlapping pair here is what keeps that trust warranted.
 */
export function doubleBookedConflicts(team: Team): DoubleBookedConflict[] {
  const conflicts: DoubleBookedConflict[] = []
  for (const period of CHARTABLE_PERIODS) {
    for (const playerId of chartedPlayerIds(team)) {
      const spans = chartedSpansInPeriod(team, period, playerId)
      for (let i = 0; i < spans.length; i++) {
        for (let j = i + 1; j < spans.length; j++) {
          const overlapStartSeconds = Math.max(spans[i].startSeconds, spans[j].startSeconds)
          const overlapEndSeconds = Math.min(spans[i].endSeconds, spans[j].endSeconds)
          if (overlapStartSeconds < overlapEndSeconds) {
            conflicts.push({ period, playerId, slots: [spans[i].slot, spans[j].slot], overlapStartSeconds, overlapEndSeconds })
          }
        }
      }
    }
  }
  return conflicts
}

export interface OutOfPositionSegment {
  period: number
  slot: Position
  playerId: PlayerId
  slideDistance: number
}

/**
 * Every charted (non-Auto) segment whose slot doesn't match the named player's own position -- the
 * chart-authoring-time counterpart to engine/positionFit.ts's in-sim penalty, so a GM sees the cost
 * while charting instead of only in the box score afterward. One entry per mismatched segment
 * (not deduplicated by player), since a badge belongs on each cell it applies to.
 */
export function outOfPositionSegments(team: Team, playersById: Map<PlayerId, Player>): OutOfPositionSegment[] {
  const flagged: OutOfPositionSegment[] = []
  for (const period of CHARTABLE_PERIODS) {
    for (const slot of POSITION_ORDER) {
      for (const segment of getSegments(team.rotationPlan, period, slot)) {
        if (segment.fill.kind !== 'player') continue
        const player = playersById.get(segment.fill.playerId)
        if (!player) continue
        const slideDistance = slotSlideDistance(player.positions[0], slot)
        if (slideDistance > 0) flagged.push({ period, slot, playerId: player.id, slideDistance })
      }
    }
  }
  return flagged
}

/**
 * Fatigue (0-100) each charted player would sit at, at the end of each regulation period, reusing
 * the same per-second gain/recovery the live sim uses (engine/rotation/fatigue.ts). Necessarily
 * approximate: any time a charted player *isn't* explicitly on the floor is assumed to be bench
 * time, since whether the real fatigue/pace heuristic would actually play them then can't be known
 * before the game is simulated. Honest for a fully-charted slot; optimistic (reads lower than a real
 * game will) for a player whose chart is full of Auto gaps the heuristic would actually fill with
 * more of their minutes. Players who don't appear anywhere in the plan aren't projected at all --
 * their fatigue is the heuristic's call from the opening tip, not this chart's.
 */
export function projectedFatigueAtPeriodEnd(team: Team, playersById: Map<PlayerId, Player>): Map<PlayerId, number[]> {
  const trajectories = new Map<PlayerId, number[]>()
  for (const playerId of chartedPlayerIds(team)) {
    const player = playersById.get(playerId)
    if (!player) continue

    let fatigue = 0
    const atPeriodEnd: number[] = []
    for (const period of CHARTABLE_PERIODS) {
      let cursor = 0
      for (const span of chartedSpansInPeriod(team, period, playerId)) {
        if (span.startSeconds > cursor) {
          fatigue = clamp(fatigue - fatigueRecoveryPerSecond(player) * (span.startSeconds - cursor), 0, 100)
        }
        fatigue = clamp(fatigue + fatigueGainPerSecond(player) * (span.endSeconds - span.startSeconds), 0, 100)
        cursor = span.endSeconds
      }
      if (cursor < PERIOD_SECONDS) fatigue = clamp(fatigue - fatigueRecoveryPerSecond(player) * (PERIOD_SECONDS - cursor), 0, 100)
      atPeriodEnd.push(Math.round(fatigue))
    }
    trajectories.set(playerId, atPeriodEnd)
  }
  return trajectories
}
