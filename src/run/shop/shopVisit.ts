import { SHOP_CONDENSED_PLAYER_CAMPS, SHOP_EXPANDED_PLAYER_CAMPS, SHOP_EXPANDED_TEAM_CAMPS } from '../constants'

export type ShopTier = 'condensed' | 'expanded'

/** A shop visit grants "purchase power" -- a count of camp buys the GM can freely spend on any
 *  roster player and any attribute, rather than a pre-rolled offer list (Section 8.4, reworked
 *  after playtesting). Decremented by buyPlayerCamp/buyTeamCamp (RunProvider) as they're spent;
 *  a visit with 0 remaining of a type just means that purchase isn't available anymore. */
export interface ShopVisit {
  tier: ShopTier
  playerCampsRemaining: number
  teamCampsRemaining: number
}

/** Opens a new shop visit for the given tier -- the expanded tier (stretch-clear only) grants
 *  more player-camp purchase power plus the pricier team-camp option; the condensed tier
 *  (every season) is player-camps only. */
export function openShopVisit(tier: ShopTier): ShopVisit {
  return {
    tier,
    playerCampsRemaining: tier === 'condensed' ? SHOP_CONDENSED_PLAYER_CAMPS : SHOP_EXPANDED_PLAYER_CAMPS,
    teamCampsRemaining: tier === 'condensed' ? 0 : SHOP_EXPANDED_TEAM_CAMPS,
  }
}
