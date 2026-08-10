import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../testFixtures'
import {
  DURABILITY_NEUTRAL,
  FATIGUE_GAIN_PER_SECOND,
  FATIGUE_HALFTIME_RECOVERY,
  FATIGUE_MULT_MAX,
  FATIGUE_MULT_MIN,
  FATIGUE_PERIOD_BREAK_RECOVERY,
  FATIGUE_RECOVERY_PER_SECOND,
  HALFTIME_AFTER_PERIOD,
  REGULATION_PERIODS,
} from '../constants'
import { slotByPosition } from '../matchup'
import { applyBreakRecovery, breakRecoveryPoints, fatigueGainPerSecond, fatigueRecoveryPerSecond, tickFatigue } from './fatigue'
import type { RotationState } from './rotationState'

describe('fatigueGainPerSecond / fatigueRecoveryPerSecond', () => {
  it('equals the base rate exactly at neutral durability', () => {
    const player = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    expect(fatigueGainPerSecond(player)).toBeCloseTo(FATIGUE_GAIN_PER_SECOND, 5)
    expect(fatigueRecoveryPerSecond(player)).toBeCloseTo(FATIGUE_RECOVERY_PER_SECOND, 5)
  })

  it('gains slower and recovers faster than base at high durability', () => {
    const player = makeTestPlayer({ hidden: { durability: 90 } })
    expect(fatigueGainPerSecond(player)).toBeLessThan(FATIGUE_GAIN_PER_SECOND)
    expect(fatigueRecoveryPerSecond(player)).toBeGreaterThan(FATIGUE_RECOVERY_PER_SECOND)
  })

  it('gains faster and recovers slower than base at low durability', () => {
    const player = makeTestPlayer({ hidden: { durability: 40 } })
    expect(fatigueGainPerSecond(player)).toBeGreaterThan(FATIGUE_GAIN_PER_SECOND)
    expect(fatigueRecoveryPerSecond(player)).toBeLessThan(FATIGUE_RECOVERY_PER_SECOND)
  })

  it('clamps the multiplier for durability far outside the normal 40-90 generation range', () => {
    // +-25 from DURABILITY_NEUTRAL (the naturally-generated extremes) only swings the multiplier
    // by +-15%, well inside [MULT_MIN, MULT_MAX] -- these values are chosen to actually hit the clamp.
    const veryLow = makeTestPlayer({ hidden: { durability: -200 } })
    const veryHigh = makeTestPlayer({ hidden: { durability: 300 } })
    expect(fatigueGainPerSecond(veryLow)).toBeCloseTo(FATIGUE_GAIN_PER_SECOND * FATIGUE_MULT_MAX, 5)
    expect(fatigueGainPerSecond(veryHigh)).toBeCloseTo(FATIGUE_GAIN_PER_SECOND * FATIGUE_MULT_MIN, 5)
  })
})

describe('tickFatigue', () => {
  function stateWith(onCourtPlayer: ReturnType<typeof makeTestPlayer>, benchPlayer: ReturnType<typeof makeTestPlayer>, fatigue: [number, number]): RotationState {
    return {
      onCourt: slotByPosition([onCourtPlayer]),
      fatigue: new Map([
        [onCourtPlayer.id, fatigue[0]],
        [benchPlayer.id, fatigue[1]],
      ]),
      secondsPlayed: new Map([
        [onCourtPlayer.id, 0],
        [benchPlayer.id, 0],
      ]),
      shiftEnteredAtSeconds: new Map(),
    }
  }

  it('increases fatigue and secondsPlayed for on-court players, recovers everyone else', () => {
    const onCourtPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const benchPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const state = stateWith(onCourtPlayer, benchPlayer, [20, 20])

    tickFatigue(state, [onCourtPlayer, benchPlayer], 15)

    expect(state.fatigue.get(onCourtPlayer.id)).toBeCloseTo(20 + FATIGUE_GAIN_PER_SECOND * 15, 5)
    expect(state.secondsPlayed.get(onCourtPlayer.id)).toBe(15)
    expect(state.fatigue.get(benchPlayer.id)).toBeCloseTo(20 - FATIGUE_RECOVERY_PER_SECOND * 15, 5)
    expect(state.secondsPlayed.get(benchPlayer.id)).toBe(0)
  })

  it('scales with the possession length, so a fast break costs less than a long half-court set', () => {
    const onCourtPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const benchPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })

    const quick = stateWith(onCourtPlayer, benchPlayer, [20, 20])
    tickFatigue(quick, [onCourtPlayer, benchPlayer], 5)
    const slow = stateWith(onCourtPlayer, benchPlayer, [20, 20])
    tickFatigue(slow, [onCourtPlayer, benchPlayer], 20)

    const quickGain = (quick.fatigue.get(onCourtPlayer.id) ?? 0) - 20
    const slowGain = (slow.fatigue.get(onCourtPlayer.id) ?? 0) - 20
    expect(slowGain).toBeCloseTo(quickGain * 4, 5)
  })

  it('clamps fatigue at 0 and 100', () => {
    const onCourtPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const benchPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const state = stateWith(onCourtPlayer, benchPlayer, [99, 1])

    tickFatigue(state, [onCourtPlayer, benchPlayer], 60)

    expect(state.fatigue.get(onCourtPlayer.id)).toBeLessThanOrEqual(100)
    expect(state.fatigue.get(benchPlayer.id)).toBeGreaterThanOrEqual(0)
  })
})

describe('breakRecoveryPoints', () => {
  it('gives the long break at halftime and the short one at a quarter', () => {
    expect(breakRecoveryPoints(HALFTIME_AFTER_PERIOD)).toBe(FATIGUE_HALFTIME_RECOVERY)
    expect(breakRecoveryPoints(1)).toBe(FATIGUE_PERIOD_BREAK_RECOVERY)
    expect(breakRecoveryPoints(3)).toBe(FATIGUE_PERIOD_BREAK_RECOVERY)
  })

  it('treats an overtime break as a quarter break, not a second halftime', () => {
    expect(breakRecoveryPoints(REGULATION_PERIODS)).toBe(FATIGUE_PERIOD_BREAK_RECOVERY)
    expect(breakRecoveryPoints(REGULATION_PERIODS + 1)).toBe(FATIGUE_PERIOD_BREAK_RECOVERY)
  })

  it('makes halftime the bigger of the two', () => {
    expect(FATIGUE_HALFTIME_RECOVERY).toBeGreaterThan(FATIGUE_PERIOD_BREAK_RECOVERY)
  })
})

describe('applyBreakRecovery', () => {
  it('rests the five who were playing, which is the whole point of it', () => {
    // tickFatigue can only ever tire an on-court player. A break is the one moment the clock is
    // stopped, so it is the only thing in the model that can give those five anything back.
    const player = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const fatigue = new Map([[player.id, 70]])
    applyBreakRecovery(fatigue, [player], HALFTIME_AFTER_PERIOD)
    expect(fatigue.get(player.id)).toBeCloseTo(70 - FATIGUE_HALFTIME_RECOVERY, 8)
  })

  it('gives two players at different fatigue the same absolute relief', () => {
    // The property that makes it flat rather than a share of what each has accumulated: a break is
    // a fixed span of sitting down, and how much good it does should not depend on how tired you
    // happened to be when it started.
    const tired = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const fresh = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const fatigue = new Map([
      [tired.id, 80],
      [fresh.id, 40],
    ])
    applyBreakRecovery(fatigue, [tired, fresh], HALFTIME_AFTER_PERIOD)
    expect(80 - (fatigue.get(tired.id) as number)).toBeCloseTo(40 - (fatigue.get(fresh.id) as number), 8)
  })

  it('lets a durable player get more out of the same break', () => {
    const ironMan = makeTestPlayer({ hidden: { durability: 90 } })
    const fragile = makeTestPlayer({ hidden: { durability: 40 } })
    const fatigue = new Map([
      [ironMan.id, 80],
      [fragile.id, 80],
    ])
    applyBreakRecovery(fatigue, [ironMan, fragile], HALFTIME_AFTER_PERIOD)
    expect(fatigue.get(ironMan.id) as number).toBeLessThan(fatigue.get(fragile.id) as number)
  })

  it('never drops below zero or hands anyone extra fatigue', () => {
    const player = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const fatigue = new Map([[player.id, 3]])
    applyBreakRecovery(fatigue, [player], HALFTIME_AFTER_PERIOD)
    expect(fatigue.get(player.id)).toBe(0)
  })

  it('leaves a player it has never seen at zero rather than undefined', () => {
    const player = makeTestPlayer()
    const fatigue = new Map<string, number>()
    applyBreakRecovery(fatigue, [player], 1)
    expect(fatigue.get(player.id)).toBe(0)
  })
})
