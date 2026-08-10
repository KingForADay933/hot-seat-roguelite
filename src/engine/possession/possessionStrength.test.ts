import { describe, expect, it } from 'vitest'
import type { OffensivePlaybook } from '../../data/presets'
import { SYNERGY_MULTIPLIER_MAX, SYNERGY_MULTIPLIER_MIN, SYNERGY_NEUTRAL } from '../constants'
import { makeTestPlayer } from '../testFixtures'
import type { PlaySelection } from './playerSelector'
import { computeOffenseStrength, synergyMultiplier } from './possessionStrength'

const dummyDefender = makeTestPlayer()

function playbook(ballMovementModifier: number): OffensivePlaybook {
  return {
    id: 'test',
    name: 'Test',
    description: 'Test',
    ballMovementModifier,
    weights: {
      'pick-and-roll': 1,
      isolation: 0,
      'post-up': 0,
      'spot-up': 0,
      cutting: 0,
      transition: 0,
    },
  }
}

function selection(primary: ReturnType<typeof makeTestPlayer>, secondaries: ReturnType<typeof makeTestPlayer>[] = []): PlaySelection {
  return {
    primary,
    secondaries,
    primaryDefender: dummyDefender,
    secondaryDefenders: [],
    isOutsideShotAction: false,
  }
}

describe('computeOffenseStrength', () => {
  it('pick-and-roll: weights handler ball-handling/passing and roller inside-shot/vertical, scaled by ball movement', () => {
    const handler = makeTestPlayer({ attributes: { ballHandling: 80, passing: 60 } })
    const roller = makeTestPlayer({ attributes: { insideShot: 70, vertical: 90 } })
    const s = computeOffenseStrength('pick-and-roll', selection(handler, [roller]), playbook(1.2))
    // 0.35*80 + 0.25*60 + 0.25*70 + 0.15*90 = 74, * 1.2 = 88.8
    expect(s).toBeCloseTo(88.8, 5)
  })

  it('isolation: uses max(outsideShot, insideShot) and the tendency shot-selection modifier, unscaled by ball movement', () => {
    const handler = makeTestPlayer({
      attributes: { ballHandling: 70, outsideShot: 80, insideShot: 60 },
      hidden: { tendency: 'balanced' },
    })
    const s = computeOffenseStrength('isolation', selection(handler), playbook(1.5))
    // 0.4*70 + 0.35*80 + 0.25*60(balanced modifier) = 28+28+15 = 71 -- NOT scaled by the 1.5 ballMovementModifier
    expect(s).toBeCloseTo(71, 5)
  })

  it('post-up: weights inside shot and vertical only', () => {
    const poster = makeTestPlayer({ attributes: { insideShot: 75, vertical: 65 } })
    const s = computeOffenseStrength('post-up', selection(poster), playbook(1))
    expect(s).toBeCloseTo(71, 5) // 0.6*75 + 0.4*65
  })

  it('spot-up: weights shooter outside-shot and creator passing, scaled by ball movement', () => {
    const shooter = makeTestPlayer({ attributes: { outsideShot: 85 } })
    const creator = makeTestPlayer({ attributes: { passing: 55 } })
    const s = computeOffenseStrength('spot-up', selection(shooter, [creator]), playbook(1.1))
    // (0.55*85 + 0.45*55) * 1.1 = 71.5 * 1.1 = 78.65
    expect(s).toBeCloseTo(78.65, 5)
  })

  it('cutting: weights the cutter speed and finishing, plus the two players average passing', () => {
    const cutter = makeTestPlayer({ attributes: { speed: 80, insideShot: 70, passing: 60 } })
    const passer = makeTestPlayer({ attributes: { passing: 90 } })
    const s = computeOffenseStrength('cutting', selection(cutter, [passer]), playbook(1))
    // 0.3*80 + 0.35*70 + 0.35*avg(90, 60) = 24 + 24.5 + 26.25 = 74.75
    expect(s).toBeCloseTo(74.75, 5)
  })

  it('transition: reads the ball-handler alone, finishing included, and never the roster rebounding', () => {
    // The formula used to blend the on-court five's mean rebounding at 0.3, which made a fast break
    // a function of how well the team boarded rather than of who was running it. The mean-rebounding
    // term is why this function once needed the whole on-court five as an argument.
    const handler = makeTestPlayer({ attributes: { speed: 85, passing: 65, insideShot: 70 } })
    const s = computeOffenseStrength('transition', selection(handler), playbook(1))
    // 0.4*85 + 0.25*65 + 0.35*70 = 34 + 16.25 + 24.5 = 74.75
    expect(s).toBeCloseTo(74.75, 5)
  })

  it('defaults synergy to 1 (neutral) when omitted, unaffecting every existing call site', () => {
    const poster = makeTestPlayer({ attributes: { insideShot: 75, vertical: 65 } })
    const withDefault = computeOffenseStrength('post-up', selection(poster), playbook(1))
    const withExplicitNeutral = computeOffenseStrength('post-up', selection(poster), playbook(1), 1)
    expect(withDefault).toBe(withExplicitNeutral)
  })

  it('scales the final result by the synergy multiplier, applied uniformly regardless of play call', () => {
    const poster = makeTestPlayer({ attributes: { insideShot: 75, vertical: 65 } })
    const neutral = computeOffenseStrength('post-up', selection(poster), playbook(1), 1)
    const boosted = computeOffenseStrength('post-up', selection(poster), playbook(1), 1.1)
    expect(boosted).toBeCloseTo(neutral * 1.1, 5)
  })
})

describe('synergyMultiplier', () => {
  it('is exactly 1 at SYNERGY_NEUTRAL', () => {
    expect(synergyMultiplier(SYNERGY_NEUTRAL)).toBe(1)
  })

  it('is greater than 1 above neutral and less than 1 below it', () => {
    expect(synergyMultiplier(SYNERGY_NEUTRAL + 10)).toBeGreaterThan(1)
    expect(synergyMultiplier(SYNERGY_NEUTRAL - 10)).toBeLessThan(1)
  })

  it('clamps to SYNERGY_MULTIPLIER_MIN/MAX at the attribute-scale extremes', () => {
    expect(synergyMultiplier(0)).toBe(SYNERGY_MULTIPLIER_MIN)
    expect(synergyMultiplier(99)).toBe(SYNERGY_MULTIPLIER_MAX)
  })
})
