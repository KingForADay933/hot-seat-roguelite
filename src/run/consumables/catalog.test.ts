import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../../engine/rng'
import { CONSUMABLES, pickConsumableOffers } from './catalog'

describe('pickConsumableOffers', () => {
  it('returns the requested count of distinct valid consumable ids', () => {
    const rng = createSeededRng(1)
    for (let i = 0; i < 20; i++) {
      const picks = pickConsumableOffers(2, rng)
      expect(picks).toHaveLength(2)
      expect(new Set(picks).size).toBe(2)
      for (const id of picks) expect(Object.keys(CONSUMABLES)).toContain(id)
    }
  })

  it('can roll the same card again on a later call -- no exclusion list, unlike coaching upgrades', () => {
    const rng = createSeededRng(2)
    const seen = new Set<string>()
    for (let i = 0; i < 30; i++) {
      for (const id of pickConsumableOffers(1, rng)) seen.add(id)
    }
    // Given enough rolls from a 7-card pool with no exclusion, every card should surface at least
    // once -- if an exclusion list were accidentally applied, this would shrink over time instead.
    expect(seen.size).toBe(Object.keys(CONSUMABLES).length)
  })
})
