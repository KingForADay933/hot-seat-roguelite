import { SHOP_CONDENSED_PLAYER_CAMP_LIMIT, SHOP_EXPANDED_PLAYER_CAMP_LIMIT, SHOP_EXPANDED_TEAM_CAMP_LIMIT } from '../constants'

export type ShopTier = 'condensed' | 'expanded'

/**
 * A shop visit's remaining purchase power (Section 8.4): how many single-player and whole-team
 * camps this visit still allows. Unlike the pre-revision shop, there's no rolled/curated player
 * list here -- the GM picks freely from the active roster (and the target attribute) at purchase
 * time, so the visit only needs to track *how many* buys of each kind are left.
 */
export interface ShopVisit {
  tier: ShopTier
  playerCampsRemaining: number
  teamCampsRemaining: number
}

/** Opens a new shop visit for the given tier -- purchase power set from the tier's limits
 *  (condensed: cheap, single-player only; expanded: more player camps plus the team camp). */
export function openShopVisit(tier: ShopTier): ShopVisit {
  if (tier === 'expanded') {
    return { tier, playerCampsRemaining: SHOP_EXPANDED_PLAYER_CAMP_LIMIT, teamCampsRemaining: SHOP_EXPANDED_TEAM_CAMP_LIMIT }
  }
  return { tier, playerCampsRemaining: SHOP_CONDENSED_PLAYER_CAMP_LIMIT, teamCampsRemaining: 0 }
}
