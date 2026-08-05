import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../engine/rng'
import { MARKET_SIZES, pickRandomMarketSize } from './marketSize'

describe('MARKET_SIZES', () => {
  it('big has the highest budget multiplier and least patience', () => {
    expect(MARKET_SIZES.big.budgetMultiplier).toBeGreaterThan(MARKET_SIZES.mid.budgetMultiplier)
    expect(MARKET_SIZES.mid.budgetMultiplier).toBeGreaterThan(MARKET_SIZES.small.budgetMultiplier)
    expect(MARKET_SIZES.big.seasonsPerStretch).toBeLessThan(MARKET_SIZES.mid.seasonsPerStretch)
    expect(MARKET_SIZES.mid.seasonsPerStretch).toBeLessThan(MARKET_SIZES.small.seasonsPerStretch)
  })
})

describe('pickRandomMarketSize', () => {
  it('always returns a valid market size id', () => {
    const rng = createSeededRng(1)
    for (let i = 0; i < 20; i++) {
      expect(Object.keys(MARKET_SIZES)).toContain(pickRandomMarketSize(rng))
    }
  })
})
