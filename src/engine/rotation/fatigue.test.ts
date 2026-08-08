import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../testFixtures'
import {
  DURABILITY_NEUTRAL,
  FATIGUE_GAIN_PER_SECOND,
  FATIGUE_MULT_MAX,
  FATIGUE_MULT_MIN,
  FATIGUE_RECOVERY_PER_SECOND,
} from '../constants'
import { slotByPosition } from '../matchup'
import { fatigueGainPerSecond, fatigueRecoveryPerSecond, tickFatigue } from './fatigue'
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
