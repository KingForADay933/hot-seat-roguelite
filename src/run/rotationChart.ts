import type { PlayerId, Position, RotationPlan, RotationSegment } from '../data/types'
import { PERIOD_SECONDS, REGULATION_PERIODS, SECONDS_PER_MINUTE } from '../engine/constants'
import { clamp } from '../engine/math'
import { POSITION_ORDER } from '../engine/matchup'
import { MIN_ROTATION_SEGMENT_SECONDS } from './constants'

/**
 * Pure mutation helpers behind the rotation chart editor (rotation-charts.md Phase G). Unlike
 * engine/rotation/rotationPlan.ts's chartedPlayerId, which treats a gap between segments the same
 * as an explicit Auto span, the editor keeps every period/slot it has touched as a full,
 * non-overlapping partition of [0, PERIOD_SECONDS) at all times -- simpler to render and to reason
 * about than tracking sparse gaps through split/merge/drag, at the cost of writing an explicit
 * `{ kind: 'auto' }` segment where Phase F would have been happy leaving nothing at all. The engine
 * doesn't care either way: a written-out auto segment and a gap evaluate identically.
 */

/** REGULATION_PERIODS worth of chartable periods -- overtime (Decision 5) is a live simcast prompt,
 *  not something authored ahead of time, so the editor only ever shows Q1-Q4. */
export const CHARTABLE_PERIODS: number[] = Array.from({ length: REGULATION_PERIODS }, (_, i) => i + 1)

/** A slot/period with nothing charted yet reads as one Auto segment spanning the whole period --
 *  Decision 3's "unfilled time is implicitly Auto" applied to a full period at once. */
function defaultSegments(): RotationSegment[] {
  return [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }]
}

export function getSegments(plan: RotationPlan | undefined, period: number, slot: Position): RotationSegment[] {
  return plan?.[period]?.[slot] ?? defaultSegments()
}

function withSegments(plan: RotationPlan | undefined, period: number, slot: Position, segments: RotationSegment[]): RotationPlan {
  return {
    ...plan,
    [period]: {
      ...plan?.[period],
      [slot]: segments,
    },
  }
}

export function setSegmentFill(
  plan: RotationPlan | undefined,
  period: number,
  slot: Position,
  index: number,
  fill: RotationSegment['fill'],
): RotationPlan {
  const segments = getSegments(plan, period, slot)
  if (!segments[index]) return plan ?? {}
  return withSegments(plan, period, slot, segments.map((s, i) => (i === index ? { ...s, fill } : s)))
}

/** Bisects a segment into two equal halves sharing its current fill -- the starting point for then
 *  dragging the new boundary and reassigning one half. No-ops (returns the plan unchanged) if the
 *  segment is too short to produce two MIN_ROTATION_SEGMENT_SECONDS-or-longer halves. */
export function splitSegment(plan: RotationPlan | undefined, period: number, slot: Position, index: number): RotationPlan {
  const segments = getSegments(plan, period, slot)
  const segment = segments[index]
  if (!segment) return plan ?? {}

  const midpoint = Math.round((segment.startSeconds + segment.endSeconds) / 2)
  if (midpoint - segment.startSeconds < MIN_ROTATION_SEGMENT_SECONDS || segment.endSeconds - midpoint < MIN_ROTATION_SEGMENT_SECONDS) {
    return plan ?? {}
  }

  const updated = [
    ...segments.slice(0, index),
    { startSeconds: segment.startSeconds, endSeconds: midpoint, fill: segment.fill },
    { startSeconds: midpoint, endSeconds: segment.endSeconds, fill: segment.fill },
    ...segments.slice(index + 1),
  ]
  return withSegments(plan, period, slot, updated)
}

/** Merges a segment into the one after it, taking the earlier segment's fill and discarding the
 *  boundary between them. No-ops on the last segment (there's nothing after it to merge with). */
export function mergeWithNext(plan: RotationPlan | undefined, period: number, slot: Position, index: number): RotationPlan {
  const segments = getSegments(plan, period, slot)
  const left = segments[index]
  const right = segments[index + 1]
  if (!left || !right) return plan ?? {}

  const merged: RotationSegment = { startSeconds: left.startSeconds, endSeconds: right.endSeconds, fill: left.fill }
  const updated = [...segments.slice(0, index), merged, ...segments.slice(index + 2)]
  return withSegments(plan, period, slot, updated)
}

/**
 * Drags the boundary between segments[index] and segments[index + 1] to a new time, clamped so
 * neither side shrinks below MIN_ROTATION_SEGMENT_SECONDS. No-ops if there's no such boundary
 * (index is the last segment, or out of range).
 */
export function moveBoundary(
  plan: RotationPlan | undefined,
  period: number,
  slot: Position,
  index: number,
  newBoundarySeconds: number,
): RotationPlan {
  const segments = getSegments(plan, period, slot)
  const left = segments[index]
  const right = segments[index + 1]
  if (!left || !right) return plan ?? {}

  const clamped = clamp(
    Math.round(newBoundarySeconds),
    left.startSeconds + MIN_ROTATION_SEGMENT_SECONDS,
    right.endSeconds - MIN_ROTATION_SEGMENT_SECONDS,
  )
  const updated = segments.map((s, i) => {
    if (i === index) return { ...s, endSeconds: clamped }
    if (i === index + 1) return { ...s, startSeconds: clamped }
    return s
  })
  return withSegments(plan, period, slot, updated)
}

/** Whether any period/slot in the plan has ever been touched -- an all-Auto plan the GM hasn't
 *  opened the editor on yet vs. one that's genuinely been charted. */
export function hasAnyChartedSegment(plan: RotationPlan | undefined): boolean {
  if (!plan) return false
  return Object.values(plan).some((bySlot) =>
    Object.values(bySlot ?? {}).some((segments) => segments?.some((s) => s.fill.kind === 'player')),
  )
}

export interface ChartedMinutes {
  /** Charted minutes per player, summed across every slot and regulation period. Counts time at
   *  *any* slot, not just the player's own -- a PG charted at SF is still on the floor. */
  byPlayer: Map<PlayerId, number>
  /** Charted minutes per slot, summed across every player -- how much of that slot's 48 the chart
   *  has already spent, and therefore how much is left for the coach heuristic to fill. */
  bySlot: Map<Position, number>
}

/**
 * How much of the game the chart actually accounts for, split both ways. Auto spans and gaps
 * contribute to neither total: nobody is assigned to them, so what the heuristic will do with that
 * time isn't knowable from the plan alone -- it's the caller's job to decide what to assume about
 * it (run/variation/systemDraft.ts's `availability` prorates rotationMinutes across it;
 * run/rotationChartValidation.ts's projected fatigue scores it as bench rest).
 */
export function chartedMinutes(plan: RotationPlan | undefined): ChartedMinutes {
  const byPlayer = new Map<PlayerId, number>()
  const bySlot = new Map<Position, number>()
  if (!plan) return { byPlayer, bySlot }

  for (const period of CHARTABLE_PERIODS) {
    for (const slot of POSITION_ORDER) {
      for (const segment of getSegments(plan, period, slot)) {
        if (segment.fill.kind !== 'player') continue
        const minutes = (segment.endSeconds - segment.startSeconds) / SECONDS_PER_MINUTE
        byPlayer.set(segment.fill.playerId, (byPlayer.get(segment.fill.playerId) ?? 0) + minutes)
        bySlot.set(slot, (bySlot.get(slot) ?? 0) + minutes)
      }
    }
  }
  return { byPlayer, bySlot }
}
