import { describe, expect, it } from 'vitest'
import type { RotationPlan } from '../data/types'
import { PERIOD_SECONDS } from '../engine/constants'
import { MIN_ROTATION_SEGMENT_SECONDS } from './constants'
import { chartedMinutes, getSegments, hasAnyChartedSegment, mergeWithNext, moveBoundary, setSegmentFill, splitSegment } from './rotationChart'

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
  it('moves a boundary to the requested time', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 300, fill: { kind: 'player', playerId: 'a' } },
          { startSeconds: 300, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'b' } },
        ],
      },
    }
    const updated = moveBoundary(plan, 1, 'PG', 0, 400)
    expect(getSegments(updated, 1, 'PG')).toEqual([
      { startSeconds: 0, endSeconds: 400, fill: { kind: 'player', playerId: 'a' } },
      { startSeconds: 400, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'b' } },
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

  it('rounds to the nearest whole second', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 300, fill: { kind: 'auto' } },
          { startSeconds: 300, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } },
        ],
      },
    }
    const updated = moveBoundary(plan, 1, 'PG', 0, 350.6)
    expect(getSegments(updated, 1, 'PG')[0].endSeconds).toBe(351)
  })

  it('is a no-op when there is no boundary at that index', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }] } }
    expect(moveBoundary(plan, 1, 'PG', 0, 400)).toBe(plan)
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
