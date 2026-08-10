import { describe, expect, it } from 'vitest'
import type { RotationPlan } from '../data/types'
import { PERIOD_SECONDS } from '../engine/constants'
import { MIN_ROTATION_SEGMENT_SECONDS, ROTATION_SNAP_SECONDS } from './constants'
import {
  chartedMinutes,
  getSegments,
  hasAnyChartedSegment,
  mergeWithNext,
  moveBoundary,
  setSegmentFill,
  snapToRotationGrid,
  splitSegment,
} from './rotationChart'

describe('getSegments', () => {
  it('defaults to one Auto segment spanning the whole period when nothing is charted', () => {
    expect(getSegments(undefined, 1, 'PG')).toEqual([{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }])
  })

  it('returns whatever is actually stored otherwise', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 300, fill: { kind: 'player', playerId: 'p1' } }] } }
    expect(getSegments(plan, 1, 'PG')).toEqual(plan[1]!.PG)
  })
})

describe('setSegmentFill', () => {
  it('sets a segment to a player, leaving its boundaries untouched', () => {
    const updated = setSegmentFill(undefined, 1, 'PG', 0, { kind: 'player', playerId: 'p1' })
    expect(getSegments(updated, 1, 'PG')).toEqual([{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'p1' } }])
  })

  it('sets a segment back to Auto', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'p1' } }] } }
    const updated = setSegmentFill(plan, 1, 'PG', 0, { kind: 'auto' })
    expect(getSegments(updated, 1, 'PG')[0].fill).toEqual({ kind: 'auto' })
  })

  it('does not disturb other periods or slots', () => {
    const updated = setSegmentFill(undefined, 2, 'C', 0, { kind: 'player', playerId: 'big' })
    expect(getSegments(updated, 1, 'PG')).toEqual([{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }])
    expect(getSegments(updated, 2, 'PG')).toEqual([{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }])
  })

  it('is a no-op for an out-of-range index', () => {
    expect(setSegmentFill(undefined, 1, 'PG', 5, { kind: 'player', playerId: 'p1' })).toEqual({})
  })
})

describe('splitSegment', () => {
  it('bisects a segment into two equal halves sharing its fill', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'p1' } }] } }
    const updated = splitSegment(plan, 1, 'PG', 0)
    expect(getSegments(updated, 1, 'PG')).toEqual([
      { startSeconds: 0, endSeconds: PERIOD_SECONDS / 2, fill: { kind: 'player', playerId: 'p1' } },
      { startSeconds: PERIOD_SECONDS / 2, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'p1' } },
    ])
  })

  it('refuses to split a segment too short to leave two valid halves', () => {
    const tiny = 2 * MIN_ROTATION_SEGMENT_SECONDS - 1
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: tiny, fill: { kind: 'auto' } }] } }
    expect(splitSegment(plan, 1, 'PG', 0)).toBe(plan)
  })

  it('allows splitting exactly at the minimum viable length', () => {
    const exact = 2 * MIN_ROTATION_SEGMENT_SECONDS
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: exact, fill: { kind: 'auto' } }] } }
    const updated = splitSegment(plan, 1, 'PG', 0)
    expect(getSegments(updated, 1, 'PG')).toHaveLength(2)
  })

  it('puts the new boundary on the grid when the true midpoint is between marks', () => {
    // 0-450 bisects at 225, which is 7.5 grid steps -- the split has to land on a mark like any
    // other boundary, or the chart acquires times the GM could never have dragged to.
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 450, fill: { kind: 'auto' } }] } }
    const segments = getSegments(splitSegment(plan, 1, 'PG', 0), 1, 'PG')

    expect(segments).toHaveLength(2)
    expect(segments[0].endSeconds % ROTATION_SNAP_SECONDS).toBe(0)
    expect(segments[0].endSeconds).toBe(240)
  })

  it('judges the minimum-length rule against the snapped split, not the ideal midpoint', () => {
    // 0-150 bisects at 75, exactly between two marks, so it snaps up to 90 -- leaving halves of 90
    // and 60, both still legal. Checking the rule before snapping would have judged a split (75/75)
    // the code was never going to make.
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 150, fill: { kind: 'auto' } }] } }
    const segments = getSegments(splitSegment(plan, 1, 'PG', 0), 1, 'PG')

    expect(segments.map((s) => s.endSeconds - s.startSeconds)).toEqual([90, 60])
    expect(segments.every((s) => s.endSeconds - s.startSeconds >= MIN_ROTATION_SEGMENT_SECONDS)).toBe(true)
  })
})

describe('mergeWithNext', () => {
  it('merges two segments, taking the earlier one\'s fill', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 300, fill: { kind: 'player', playerId: 'starter' } },
          { startSeconds: 300, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } },
        ],
      },
    }
    const updated = mergeWithNext(plan, 1, 'PG', 0)
    expect(getSegments(updated, 1, 'PG')).toEqual([
      { startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'starter' } },
    ])
  })

  it('is a no-op on the last segment', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }] } }
    expect(mergeWithNext(plan, 1, 'PG', 0)).toBe(plan)
  })
})

describe('moveBoundary', () => {
  it('moves a boundary to the requested time, snapped to the grid', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 300, fill: { kind: 'player', playerId: 'a' } },
          { startSeconds: 300, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'b' } },
        ],
      },
    }
    const updated = moveBoundary(plan, 1, 'PG', 0, 400)
    // 400 is 13.3 grid steps in; the nearest mark is 390.
    expect(getSegments(updated, 1, 'PG')).toEqual([
      { startSeconds: 0, endSeconds: 390, fill: { kind: 'player', playerId: 'a' } },
      { startSeconds: 390, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'b' } },
    ])
  })

  it('clamps so neither side shrinks below MIN_ROTATION_SEGMENT_SECONDS', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 300, fill: { kind: 'auto' } },
          { startSeconds: 300, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } },
        ],
      },
    }
    const draggedToZero = moveBoundary(plan, 1, 'PG', 0, 0)
    expect(getSegments(draggedToZero, 1, 'PG')[0].endSeconds).toBe(MIN_ROTATION_SEGMENT_SECONDS)

    const draggedPastEnd = moveBoundary(plan, 1, 'PG', 0, PERIOD_SECONDS)
    expect(getSegments(draggedPastEnd, 1, 'PG')[0].endSeconds).toBe(PERIOD_SECONDS - MIN_ROTATION_SEGMENT_SECONDS)
  })

  it('snaps a fractional drag position onto the grid rather than to the nearest second', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 300, fill: { kind: 'auto' } },
          { startSeconds: 300, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } },
        ],
      },
    }
    // A pointer position is a fraction of the bar's width, so it arrives fractional; 350.6 is
    // nearest the 360 mark.
    expect(getSegments(moveBoundary(plan, 1, 'PG', 0, 350.6), 1, 'PG')[0].endSeconds).toBe(360)
    // ...and rounds down when that's nearer.
    expect(getSegments(moveBoundary(plan, 1, 'PG', 0, 344), 1, 'PG')[0].endSeconds).toBe(330)
  })

  it('lands every reachable boundary on the grid, wherever the drag goes', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 300, fill: { kind: 'auto' } },
          { startSeconds: 300, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } },
        ],
      },
    }
    // Sweeping the whole bar, including well past both ends where the clamp takes over.
    for (let requested = -120; requested <= PERIOD_SECONDS + 120; requested += 7) {
      const boundary = getSegments(moveBoundary(plan, 1, 'PG', 0, requested), 1, 'PG')[0].endSeconds
      expect(boundary % ROTATION_SNAP_SECONDS, `drag to ${requested} produced ${boundary}`).toBe(0)
      // The grid must never win against the minimum-length rule.
      expect(boundary).toBeGreaterThanOrEqual(MIN_ROTATION_SEGMENT_SECONDS)
      expect(boundary).toBeLessThanOrEqual(PERIOD_SECONDS - MIN_ROTATION_SEGMENT_SECONDS)
    }
  })

  it('is a no-op when there is no boundary at that index', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }] } }
    expect(moveBoundary(plan, 1, 'PG', 0, 400)).toBe(plan)
  })
})

describe('snapToRotationGrid', () => {
  it('rounds to the nearest mark, halfway cases upward', () => {
    expect(snapToRotationGrid(0)).toBe(0)
    expect(snapToRotationGrid(14)).toBe(0)
    expect(snapToRotationGrid(15)).toBe(30)
    expect(snapToRotationGrid(44)).toBe(30)
    expect(snapToRotationGrid(350.6)).toBe(360)
  })

  it('leaves the period edges and the minimum span exactly where they are', () => {
    // The grid was chosen to divide both; if that ever stops being true, the clamping in
    // moveBoundary silently starts producing off-grid boundaries.
    expect(PERIOD_SECONDS % ROTATION_SNAP_SECONDS).toBe(0)
    expect(MIN_ROTATION_SEGMENT_SECONDS % ROTATION_SNAP_SECONDS).toBe(0)
    expect(snapToRotationGrid(PERIOD_SECONDS)).toBe(PERIOD_SECONDS)
  })
})

describe('hasAnyChartedSegment', () => {
  it('is false with no plan', () => {
    expect(hasAnyChartedSegment(undefined)).toBe(false)
  })

  it('is false with a plan that only ever sets Auto', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }] } }
    expect(hasAnyChartedSegment(plan)).toBe(false)
  })

  it('is true once any segment anywhere names a player', () => {
    const plan: RotationPlan = { 3: { C: [{ startSeconds: 500, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'closer' } }] } }
    expect(hasAnyChartedSegment(plan)).toBe(true)
  })
})

describe('chartedMinutes', () => {
  it('is empty with no plan', () => {
    const { byPlayer, bySlot } = chartedMinutes(undefined)
    expect(byPlayer.size).toBe(0)
    expect(bySlot.size).toBe(0)
  })

  it('ignores Auto spans -- nobody is assigned to them', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }] } }
    expect(chartedMinutes(plan).byPlayer.size).toBe(0)
    expect(chartedMinutes(plan).bySlot.size).toBe(0)
  })

  it('sums a player across periods and slots, and each slot across players', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 360, fill: { kind: 'player', playerId: 'a' } },
          { startSeconds: 360, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'b' } },
        ],
      },
      // Same player again, in a different period and at a different slot -- both count toward him.
      2: { SF: [{ startSeconds: 0, endSeconds: 360, fill: { kind: 'player', playerId: 'a' } }] },
    }

    const { byPlayer, bySlot } = chartedMinutes(plan)
    expect(byPlayer.get('a')).toBe(12) // 6 minutes at PG in Q1 + 6 at SF in Q2
    expect(byPlayer.get('b')).toBe(6)
    expect(bySlot.get('PG')).toBe(12) // the whole Q1 period, split between two players
    expect(bySlot.get('SF')).toBe(6)
  })

  it('counts only the four regulation periods the editor can author', () => {
    const overtimeOnly: RotationPlan = {
      5: { C: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'closer' } }] },
    }
    expect(chartedMinutes(overtimeOnly).byPlayer.size).toBe(0)
  })
})
