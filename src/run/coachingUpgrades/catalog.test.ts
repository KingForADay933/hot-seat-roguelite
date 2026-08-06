import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../../engine/rng'
import { COACHING_UPGRADES, pickCoachingUpgradeOffers, type CoachingUpgradeId } from './catalog'

describe('pickCoachingUpgradeOffers', () => {
  it('returns the requested count of distinct valid upgrade ids', () => {
    const rng = createSeededRng(1)
    for (let i = 0; i < 20; i++) {
      const picks = pickCoachingUpgradeOffers([], 2, rng)
      expect(picks).toHaveLength(2)
      expect(new Set(picks).size).toBe(2)
      for (const id of picks) expect(Object.keys(COACHING_UPGRADES)).toContain(id)
    }
  })

  it('excludes owned ids from the roll', () => {
    const owned: CoachingUpgradeId[] = ['clutch-gene', 'iron-man-program', 'film-study']
    const rng = createSeededRng(2)
    for (let i = 0; i < 20; i++) {
      const picks = pickCoachingUpgradeOffers(owned, 3, rng)
      for (const id of picks) expect(owned).not.toContain(id)
    }
  })

  it('returns fewer than requested (never throws) once the pool is exhausted', () => {
    const allButOne = (Object.keys(COACHING_UPGRADES) as CoachingUpgradeId[]).slice(1)
    const picks = pickCoachingUpgradeOffers(allButOne, 2, createSeededRng(3))
    expect(picks).toHaveLength(1)
  })

  it('returns an empty array once every card is owned', () => {
    const allOwned = Object.keys(COACHING_UPGRADES) as CoachingUpgradeId[]
    expect(pickCoachingUpgradeOffers(allOwned, 2, createSeededRng(4))).toEqual([])
  })
})
