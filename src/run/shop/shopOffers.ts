import { createId } from '../../data/ids'
import type { Player, PlayerId } from '../../data/types'
import type { Rng } from '../../engine/rng'
import {
  PLAYER_CAMP_COST,
  SHOP_CONDENSED_OFFER_COUNT,
  SHOP_EXPANDED_PLAYER_OFFER_COUNT,
  SHOP_EXPANDED_REROLLS,
  SHOP_EXPANDED_TEAM_OFFER_COUNT,
  TEAM_CAMP_COST,
} from '../constants'
import { pickDistinct } from '../variation/draftPool'

export type ShopTier = 'condensed' | 'expanded'
export type ShopOfferType = 'player-camp' | 'team-camp'

export interface ShopOffer {
  id: string
  type: ShopOfferType
  cost: number
  /** The camp's target; null for a team-camp offer, which touches the whole roster. */
  playerId: PlayerId | null
}

export interface ShopVisit {
  tier: ShopTier
  offers: ShopOffer[]
  rerollsRemaining: number
}

function playerCampOffers(roster: Player[], count: number, rng: Rng): ShopOffer[] {
  const targets = pickDistinct(roster, Math.min(count, roster.length), rng)
  return targets.map((p) => ({ id: createId('shop-offer'), type: 'player-camp', cost: PLAYER_CAMP_COST, playerId: p.id }))
}

function teamCampOffers(count: number): ShopOffer[] {
  return Array.from({ length: count }, () => ({ id: createId('shop-offer'), type: 'team-camp', cost: TEAM_CAMP_COST, playerId: null }))
}

/**
 * Rolls a fresh offer list for a shop tier (Section 8.5): the condensed tier is a cheap,
 * every-season glance limited to single-player camps; the expanded tier -- unlocked by a
 * stretch-clear -- adds the pricier whole-team camp on top.
 */
export function generateShopOffers(tier: ShopTier, roster: Player[], rng: Rng): ShopOffer[] {
  if (tier === 'condensed') return playerCampOffers(roster, SHOP_CONDENSED_OFFER_COUNT, rng)
  return [...playerCampOffers(roster, SHOP_EXPANDED_PLAYER_OFFER_COUNT, rng), ...teamCampOffers(SHOP_EXPANDED_TEAM_OFFER_COUNT)]
}

/** Opens a new shop visit for the given tier -- the offer list plus however many free rerolls
 *  that tier grants (expanded only, see SHOP_EXPANDED_REROLLS). */
export function openShopVisit(tier: ShopTier, roster: Player[], rng: Rng): ShopVisit {
  return { tier, offers: generateShopOffers(tier, roster, rng), rerollsRemaining: tier === 'expanded' ? SHOP_EXPANDED_REROLLS : 0 }
}
