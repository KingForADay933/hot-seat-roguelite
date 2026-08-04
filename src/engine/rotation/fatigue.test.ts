import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../testFixtures'
import {
  DURABILITY_NEUTRAL,
  FATIGUE_GAIN_BASE,
  FATIGUE_MULT_MAX,
  FATIGUE_MULT_MIN,
  FATIGUE_RECOVERY_BASE,
} from '../constants'
import { fatigueGainPerPossession, fatigueRecoveryPerPossession, tickFatigue } from './fatigue'
import type { RotationState } from './rotationState'

describe('fatigueGainPerPossession / fatigueRecoveryPerPossession', () => {
  it('equals the base rate exactly at neutral durability', () => {
    const player = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    expect(fatigueGainPerPossession(player)).toBeCloseTo(FATIGUE_GAIN_BASE, 5)
    expect(fatigueRecoveryPerPossession(player)).toBeCloseTo(FATIGUE_RECOVERY_BASE, 5)
  })

  it('gains slower and recovers faster than base at high durability', () => {
    const player = makeTestPlayer({ hidden: { durability: 90 } })
    expect(fatigueGainPerPossession(player)).toBeLessThan(FATIGUE_GAIN_BASE)
    expect(fatigueRecoveryPerPossession(player)).toBeGreaterThan(FATIGUE_RECOVERY_BASE)
  })

  it('gains faster and recovers slower than base at low durability', () => {
    const player = makeTestPlayer({ hidden: { durability: 40 } })
    expect(fatigueGainPerPossession(player)).toBeGreaterThan(FATIGUE_GAIN_BASE)
    expect(fatigueRecoveryPerPossession(player)).toBeLessThan(FATIGUE_RECOVERY_BASE)
  })

  it('clamps the multiplier for durability far outside the normal 40-90 generation range', () => {
    // +-25 from DURABILITY_NEUTRAL (the naturally-generated extremes) only swings the multiplier
    // by +-15%, well inside [MULT_MIN, MULT_MAX] -- these values are chosen to actually hit the clamp.
    const veryLow = makeTestPlayer({ hidden: { durability: -200 } })
    const veryHigh = makeTestPlayer({ hidden: { durability: 300 } })
    expect(fatigueGainPerPossession(veryLow)).toBeCloseTo(FATIGUE_GAIN_BASE * FATIGUE_MULT_MAX, 5)
    expect(fatigueGainPerPossession(veryHigh)).toBeCloseTo(FATIGUE_GAIN_BASE * FATIGUE_MULT_MIN, 5)
  })
})

describe('tickFatigue', () => {
  it('increases fatigue and possessionsPlayed for on-court players, recovers everyone else', () => {
    const onCourtPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const benchPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const roster = [onCourtPlayer, benchPlayer]

    const state: RotationState = {
      onCourt: [onCourtPlayer],
      fatigue: new Map([
        [onCourtPlayer.id, 20],
        [benchPlayer.id, 20],
      ]),
      possessionsPlayed: new Map([
        [onCourtPlayer.id, 3],
        [benchPlayer.id, 0],
      ]),
      shiftEnteredAt: new Map(),
    }

    tickFatigue(state, roster)

    expect(state.fatigue.get(onCourtPlayer.id)).toBeCloseTo(20 + FATIGUE_GAIN_BASE, 5)
    expect(state.possessionsPlayed.get(onCourtPlayer.id)).toBe(4)
    expect(state.fatigue.get(benchPlayer.id)).toBeCloseTo(20 - FATIGUE_RECOVERY_BASE, 5)
    expect(state.possessionsPlayed.get(benchPlayer.id)).toBe(0)
  })

  it('clamps fatigue at 0 and 100', () => {
    const onCourtPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const benchPlayer = makeTestPlayer({ hidden: { durability: DURABILITY_NEUTRAL } })
    const roster = [onCourtPlayer, benchPlayer]

    const state: RotationState = {
      onCourt: [onCourtPlayer],
      fatigue: new Map([
        [onCourtPlayer.id, 99],
        [benchPlayer.id, 1],
      ]),
      possessionsPlayed: new Map([
        [onCourtPlayer.id, 0],
        [benchPlayer.id, 0],
      ]),
      shiftEnteredAt: new Map(),
    }

    tickFatigue(state, roster)

    expect(state.fatigue.get(onCourtPlayer.id)).toBeLessThanOrEqual(100)
    expect(state.fatigue.get(benchPlayer.id)).toBeGreaterThanOrEqual(0)
  })
})
