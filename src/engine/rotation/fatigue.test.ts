import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../testFixtures'
import {
  DURABILITY_NEUTRAL,
  FATIGUE_GAIN_PER_SECOND,
  FATIGUE_HALFTIME_RECOVERY,
  FATIGUE_MULT_MAX,
  FATIGUE_MULT_MIN,
  FATIGUE_PERIOD_BREAK_RECOVERY,
  FATIGUE_PENALTY_FULL_AT,
  FATIGUE_PENALTY_THRESHOLD,
  FATIGUE_RECOVERY_PER_SECOND,
  HALFTIME_AFTER_PERIOD,
  REGULATION_PERIODS,
} from '../constants'
import { slotByPosition } from '../matchup'
import {
  applyBreakRecovery,
  breakRecoveryPoints,
  fatiguedPlayer,
  fatigueGainPerSecond,
  fatiguePenaltyScale,
  fatigueRecoveryPerSecond,
  tickFatigue,
} from './fatigue'
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

describe('fatiguePenaltyScale', () => {
  it('is zero at and below the threshold, where most of the league lives', () => {
    expect(fatiguePenaltyScale(0)).toBe(0)
    expect(fatiguePenaltyScale(FATIGUE_PENALTY_THRESHOLD)).toBe(0)
  })

  it('reaches full at the ceiling and stays there', () => {
    expect(fatiguePenaltyScale(FATIGUE_PENALTY_FULL_AT)).toBe(1)
    expect(fatiguePenaltyScale(100)).toBe(1)
  })

  it('ramps linearly between the two', () => {
    const midpoint = (FATIGUE_PENALTY_THRESHOLD + FATIGUE_PENALTY_FULL_AT) / 2
    expect(fatiguePenaltyScale(midpoint)).toBeCloseTo(0.5, 8)
  })

  it('tops out inside the fatigue players actually reach', () => {
    // The measured ceiling across 30 games was 65.3, so a band ending at 100 would have meant the
    // penalty never got past about a third of its strength. This is the assertion that catches
    // somebody later "tidying" the band back to the nominal 0-100 scale.
    expect(FATIGUE_PENALTY_FULL_AT).toBeLessThanOrEqual(70)
  })
})

describe('fatiguedPlayer', () => {
  const fresh = () => makeTestPlayer({ hidden: { consistency: 70 }, attributes: { outsideShot: 80, passing: 80 } })

  it('hands back the same reference below the threshold', () => {
    const player = fresh()
    expect(fatiguedPlayer(player, FATIGUE_PENALTY_THRESHOLD)).toBe(player)
  })

  it('takes more off the legs than the hands', () => {
    // The weighting that makes a late-game lineup a decision: shooters fade, passers mostly do not.
    const player = fresh()
    const tired = fatiguedPlayer(player, FATIGUE_PENALTY_FULL_AT)
    const shotLost = 80 - tired.attributes.outsideShot
    const passLost = 80 - tired.attributes.passing

    expect(shotLost).toBeGreaterThan(passLost)
    expect(passLost).toBeGreaterThan(0)
  })

  it('scales with how tired he is', () => {
    const player = fresh()
    const midpoint = (FATIGUE_PENALTY_THRESHOLD + FATIGUE_PENALTY_FULL_AT) / 2
    const halfway = fatiguedPlayer(player, midpoint).attributes.outsideShot
    const spent = fatiguedPlayer(player, FATIGUE_PENALTY_FULL_AT).attributes.outsideShot

    expect(halfway).toBeLessThan(80)
    expect(spent).toBeLessThan(halfway)
  })

  it('makes him less consistent as well as worse, which is the variance half', () => {
    // possession/variance.ts derives its noise from (100 - consistency), so docking it here is the
    // whole of the mechanism -- no new parameter, no change to that file.
    const player = fresh()
    expect(fatiguedPlayer(player, FATIGUE_PENALTY_FULL_AT).hidden.consistency).toBeLessThan(player.hidden.consistency)
  })

  it('leaves durability and clutch alone', () => {
    // Durability drives fatigue accrual itself, so docking it would make tiredness compound into more
    // tiredness. Clutch is a separate late-game read and has no business moving here.
    const player = fresh()
    const tired = fatiguedPlayer(player, FATIGUE_PENALTY_FULL_AT)
    expect(tired.hidden.durability).toBe(player.hidden.durability)
    expect(tired.hidden.clutch).toBe(player.hidden.clutch)
  })

  it('never mutates the player it was handed, and never touches overallRating', () => {
    const player = fresh()
    player.overallRating = 12345
    const tired = fatiguedPlayer(player, 100)
    expect(player.attributes.outsideShot).toBe(80)
    expect(player.hidden.consistency).toBe(70)
    expect(tired.overallRating).toBe(12345)
  })

  it('never drives an attribute below zero', () => {
    const weak = makeTestPlayer({ attributes: { outsideShot: 1 } })
    expect(fatiguedPlayer(weak, 100).attributes.outsideShot).toBeGreaterThanOrEqual(0)
  })
})
