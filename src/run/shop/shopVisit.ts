import type { Rng } from '../../engine/rng'
import { pickCoachingUpgradeOffers, type CoachingUpgradeId } from '../coachingUpgrades/catalog'
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
import { pickConsumableOffers, type ConsumableId } from '../consumables/catalog'

export type ShopTier = 'condensed' | 'expanded'

/**
 * A shop visit's remaining purchase power (Section 8.4): how many single-player and whole-team
 * camps this visit still allows. Unlike the pre-revision shop, there's no rolled/curated player
 * list here -- the GM picks freely from the active roster (and the target attribute) at purchase
 * time, so the visit only needs to track *how many* buys of each kind are left.
 *
 * Coaching upgrades (Section 8.6) and consumables (Section 8.7) are the one piece of the
 * pre-revision shop kept as-is: neither is a player-specific pick the way camps are, so both stay
 * a rolled, buy-one-of-these-cards list with its own limited reroll, not open GM choice.
 */
export interface ShopVisit {
  tier: ShopTier
  playerCampsRemaining: number
  teamCampsRemaining: number
  upgradeOffers: CoachingUpgradeId[]
  upgradeRerollsRemaining: number
  consumableOffers: ConsumableId[]
  consumableRerollsRemaining: number
}

/** Opens a new shop visit for the given tier -- purchase power set from the tier's limits
 *  (condensed: cheap, single-player only; expanded: more player camps plus the team camp), plus
 *  freshly-rolled coaching-upgrade and consumable offer lists. Coaching-upgrade offers exclude
 *  whatever's already owned this run; consumable offers don't, since duplicates in inventory are
 *  fine (see pickConsumableOffers). */
export function openShopVisit(tier: ShopTier, ownedUpgrades: CoachingUpgradeId[], rng: Rng): ShopVisit {
  const upgradeDraftSize = tier === 'expanded' ? COACHING_UPGRADE_DRAFT_SIZE_EXPANDED : COACHING_UPGRADE_DRAFT_SIZE_CONDENSED
  const upgradeOffers = pickCoachingUpgradeOffers(ownedUpgrades, upgradeDraftSize, rng)
  const upgradeRerollsRemaining = tier === 'expanded' ? COACHING_UPGRADE_REROLLS_EXPANDED : 0

  const consumableDraftSize = tier === 'expanded' ? CONSUMABLE_DRAFT_SIZE_EXPANDED : CONSUMABLE_DRAFT_SIZE_CONDENSED
  const consumableOffers = pickConsumableOffers(consumableDraftSize, rng)
  const consumableRerollsRemaining = tier === 'expanded' ? CONSUMABLE_REROLLS_EXPANDED : 0

  if (tier === 'expanded') {
    return {
      tier,
      playerCampsRemaining: SHOP_EXPANDED_PLAYER_CAMP_LIMIT,
      teamCampsRemaining: SHOP_EXPANDED_TEAM_CAMP_LIMIT,
      upgradeOffers,
      upgradeRerollsRemaining,
      consumableOffers,
      consumableRerollsRemaining,
    }
  }
  return {
    tier,
    playerCampsRemaining: SHOP_CONDENSED_PLAYER_CAMP_LIMIT,
    teamCampsRemaining: 0,
    upgradeOffers,
    upgradeRerollsRemaining,
    consumableOffers,
    consumableRerollsRemaining,
  }
}
