import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../testFixtures'
import { ATTRIBUTE_KEYS, computeEffectiveFocusWeights } from './trainingFocus'

describe('computeEffectiveFocusWeights', () => {
  it('normalizes an explicit override even when it does not sum to 100', () => {
    const player = makeTestPlayer()
    const weights = computeEffectiveFocusWeights(player, { insideShot: 30, outsideShot: 10 })
    const total = ATTRIBUTE_KEYS.reduce((sum, key) => sum + weights[key], 0)
    expect(total).toBeCloseTo(1, 5)
    expect(weights.insideShot).toBeCloseTo(0.75, 5)
    expect(weights.outsideShot).toBeCloseTo(0.25, 5)
    expect(weights.passing).toBe(0)
  })

  it('falls back to gap-proportional auto-weights when there is no override', () => {
    const player = makeTestPlayer({
      attributes: { insideShot: 50, outsideShot: 80 },
      development: { potential: { insideShot: 90, outsideShot: 85, passing: 85, ballHandling: 85, rebounding: 85, perimeterDefense: 85, interiorDefense: 85, speed: 85, lateralQuickness: 85, vertical: 85 } },
    })
    const weights = computeEffectiveFocusWeights(player, undefined)
    // insideShot has a 40-point gap (90-50), outsideShot only a 5-point gap (85-80) -- insideShot should dominate.
    expect(weights.insideShot).toBeGreaterThan(weights.outsideShot)
    const total = ATTRIBUTE_KEYS.reduce((sum, key) => sum + weights[key], 0)
    expect(total).toBeCloseTo(1, 5)
  })

  it('falls back to an even split without NaN when every gap is 0 (a fully-capped player)', () => {
    const player = makeTestPlayer({
      attributes: { insideShot: 85, outsideShot: 85, passing: 85, ballHandling: 85, rebounding: 85, perimeterDefense: 85, interiorDefense: 85, speed: 85, lateralQuickness: 85, vertical: 85 },
    })
    const weights = computeEffectiveFocusWeights(player, undefined)
    for (const key of ATTRIBUTE_KEYS) {
      expect(weights[key]).toBeCloseTo(0.1, 5)
      expect(Number.isNaN(weights[key])).toBe(false)
    }
  })

  it('falls back to auto-weights when an override is present but sums to 0', () => {
    const player = makeTestPlayer({ attributes: { insideShot: 50 } })
    const weights = computeEffectiveFocusWeights(player, { insideShot: 0, outsideShot: 0 })
    const total = ATTRIBUTE_KEYS.reduce((sum, key) => sum + weights[key], 0)
    expect(total).toBeCloseTo(1, 5)
    expect(weights.insideShot).toBeGreaterThan(0) // gap-proportional fallback, not stuck at the 0 override
  })
})
