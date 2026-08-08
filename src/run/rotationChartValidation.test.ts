import { describe, expect, it } from 'vitest'
import type { RotationPlan } from '../data/types'
import { DURABILITY_NEUTRAL, FATIGUE_GAIN_PER_SECOND, FATIGUE_RECOVERY_PER_SECOND, PERIOD_SECONDS } from '../engine/constants'
import { clamp } from '../engine/math'
import { makeTestPlayer, makeTestTeam } from '../engine/testFixtures'
import { chartedMinutesByPlayer, doubleBookedConflicts, outOfPositionSegments, projectedFatigueAtPeriodEnd } from './rotationChartValidation'

describe('chartedMinutesByPlayer', () => {
  it('is empty with no plan', () => {
    expect(chartedMinutesByPlayer(makeTestTeam())).toEqual(new Map())
  })

  it('sums charted (non-Auto) seconds across every period, converted to minutes', () => {
    const plan: RotationPlan = {
      1: { PG: [{ startSeconds: 0, endSeconds: 300, fill: { kind: 'player', playerId: 'p1' } }] },
      2: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'p1' } }] },
    }
    const minutes = chartedMinutesByPlayer(makeTestTeam({ rotationPlan: plan }))
    expect(minutes.get('p1')).toBeCloseTo((300 + PERIOD_SECONDS) / 60, 5)
  })

  it('does not count Auto spans toward anyone', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }] } }
    expect(chartedMinutesByPlayer(makeTestTeam({ rotationPlan: plan }))).toEqual(new Map())
  })
})

describe('doubleBookedConflicts', () => {
  it('is empty with no plan', () => {
    expect(doubleBookedConflicts(makeTestTeam())).toEqual([])
  })

  it('flags the same player named in two slots at an overlapping time', () => {
    const plan: RotationPlan = {
      1: {
        PG: [{ startSeconds: 0, endSeconds: 400, fill: { kind: 'player', playerId: 'p1' } }],
        SG: [{ startSeconds: 200, endSeconds: 600, fill: { kind: 'player', playerId: 'p1' } }],
      },
    }
    const conflicts = doubleBookedConflicts(makeTestTeam({ rotationPlan: plan }))
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({ period: 1, playerId: 'p1', overlapStartSeconds: 200, overlapEndSeconds: 400 })
    expect(conflicts[0].slots.sort()).toEqual(['PG', 'SG'])
  })

  it('does not flag back-to-back segments in different slots that never overlap', () => {
    const plan: RotationPlan = {
      1: {
        PG: [{ startSeconds: 0, endSeconds: 300, fill: { kind: 'player', playerId: 'p1' } }],
        SG: [{ startSeconds: 300, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'p1' } }],
      },
    }
    expect(doubleBookedConflicts(makeTestTeam({ rotationPlan: plan }))).toEqual([])
  })

  it('does not flag the same player appearing in two different periods', () => {
    const plan: RotationPlan = {
      1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'p1' } }] },
      2: { SG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: 'p1' } }] },
    }
    expect(doubleBookedConflicts(makeTestTeam({ rotationPlan: plan }))).toEqual([])
  })
})

describe('outOfPositionSegments', () => {
  it('flags a segment whose slot does not match the named player\'s own position', () => {
    const guard = makeTestPlayer({ positions: ['PG'] })
    const plan: RotationPlan = { 1: { C: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: guard.id } }] } }
    const flagged = outOfPositionSegments(makeTestTeam({ rotationPlan: plan }), new Map([[guard.id, guard]]))
    expect(flagged).toEqual([{ period: 1, slot: 'C', playerId: guard.id, slideDistance: 4 }])
  })

  it('does not flag a segment where the slot matches the player\'s own position', () => {
    const guard = makeTestPlayer({ positions: ['PG'] })
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: guard.id } }] } }
    expect(outOfPositionSegments(makeTestTeam({ rotationPlan: plan }), new Map([[guard.id, guard]]))).toEqual([])
  })

  it('never flags an Auto segment', () => {
    const plan: RotationPlan = { 1: { C: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }] } }
    expect(outOfPositionSegments(makeTestTeam({ rotationPlan: plan }), new Map())).toEqual([])
  })
})

describe('projectedFatigueAtPeriodEnd', () => {
  it('is empty for a player who never appears in the plan', () => {
    expect(projectedFatigueAtPeriodEnd(makeTestTeam(), new Map())).toEqual(new Map())
  })

  it('projects gain while on the charted floor and recovery everywhere else, at neutral durability', () => {
    const player = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 200, fill: { kind: 'player', playerId: player.id } }] } }
    const trajectory = projectedFatigueAtPeriodEnd(makeTestTeam({ rotationPlan: plan }), new Map([[player.id, player]]))

    const afterOnCourt = clamp(FATIGUE_GAIN_PER_SECOND * 200, 0, 100)
    const expectedEndOfQ1 = clamp(afterOnCourt - FATIGUE_RECOVERY_PER_SECOND * (PERIOD_SECONDS - 200), 0, 100)
    expect(trajectory.get(player.id)?.[0]).toBe(Math.round(expectedEndOfQ1))
    expect(trajectory.get(player.id)).toHaveLength(4)
  })

  it('keeps recovering through periods with no charted segment at all, floored at 0', () => {
    const player = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 200, fill: { kind: 'player', playerId: player.id } }] } }
    const trajectory = projectedFatigueAtPeriodEnd(makeTestTeam({ rotationPlan: plan }), new Map([[player.id, player]]))

    // Three more full periods of bench recovery after a 200-second stint is comfortably enough to
    // floor out, given FATIGUE_RECOVERY_PER_SECOND * PERIOD_SECONDS alone already exceeds 100.
    expect(trajectory.get(player.id)?.[3]).toBe(0)
  })

  it('saturates at 100 rather than exceeding it for a full period on the floor', () => {
    const player = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const plan: RotationPlan = { 1: { C: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player', playerId: player.id } }] } }
    const trajectory = projectedFatigueAtPeriodEnd(makeTestTeam({ rotationPlan: plan }), new Map([[player.id, player]]))
    expect(trajectory.get(player.id)?.[0]).toBe(100)
  })
})
