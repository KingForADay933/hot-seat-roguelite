import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../../engine/rng'
import type { CoachingUpgradeId } from '../coachingUpgrades/catalog'
import {
  COACHING_UPGRADE_DRAFT_SIZE_CONDENSED,
  COACHING_UPGRADE_DRAFT_SIZE_EXPANDED,
  COACHING_UPGRADE_REROLLS_EXPANDED,
  CONSUMABLE_DRAFT_SIZE_CONDENSED,
  CONSUMABLE_DRAFT_SIZE_EXPANDED,
  CONSUMABLE_REROLLS_EXPANDED,
  SHOP_CONDENSED_PLAYER_CAMP_LIMIT,
  SHOP_EXPANDED_PLAYER_CAMP_LIMIT,
  SHOP_EXPANDED_TEAM_CAMP_LIMIT,
} from '../constants'
import { openShopVisit } from './shopVisit'

const NO_OWNED: CoachingUpgradeId[] = []

describe('openShopVisit', () => {
  it('grants only single-player camp purchase power on the condensed tier, plus 1 upgrade offer/1 consumable offer and no rerolls', () => {
    const visit = openShopVisit('condensed', NO_OWNED, createSeededRng(1))
    expect(visit.tier).toBe('condensed')
    expect(visit.playerCampsRemaining).toBe(SHOP_CONDENSED_PLAYER_CAMP_LIMIT)
    expect(visit.teamCampsRemaining).toBe(0)
    expect(visit.upgradeOffers).toHaveLength(COACHING_UPGRADE_DRAFT_SIZE_CONDENSED)
    expect(visit.upgradeRerollsRemaining).toBe(0)
    expect(visit.consumableOffers).toHaveLength(CONSUMABLE_DRAFT_SIZE_CONDENSED)
    expect(visit.consumableRerollsRemaining).toBe(0)
  })

  it('grants more player-camp purchase power plus team-camp purchase power on the expanded tier, plus 2 upgrade/consumable offers and both rerolls', () => {
    const visit = openShopVisit('expanded', NO_OWNED, createSeededRng(1))
    expect(visit.tier).toBe('expanded')
    expect(visit.playerCampsRemaining).toBe(SHOP_EXPANDED_PLAYER_CAMP_LIMIT)
    expect(visit.teamCampsRemaining).toBe(SHOP_EXPANDED_TEAM_CAMP_LIMIT)
    expect(visit.upgradeOffers).toHaveLength(COACHING_UPGRADE_DRAFT_SIZE_EXPANDED)
    expect(visit.upgradeRerollsRemaining).toBe(COACHING_UPGRADE_REROLLS_EXPANDED)
    expect(visit.consumableOffers).toHaveLength(CONSUMABLE_DRAFT_SIZE_EXPANDED)
    expect(visit.consumableRerollsRemaining).toBe(CONSUMABLE_REROLLS_EXPANDED)
  })

  it('excludes already-owned upgrades from the offer list', () => {
    const owned: CoachingUpgradeId[] = ['clutch-gene', 'iron-man-program']
    const visit = openShopVisit('expanded', owned, createSeededRng(1))
    for (const id of visit.upgradeOffers) expect(owned).not.toContain(id)
  })
})
