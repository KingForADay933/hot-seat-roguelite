import type { Rng } from '../engine/rng'
import {
  MARKET_BUDGET_MULTIPLIER_BIG,
  MARKET_BUDGET_MULTIPLIER_MID,
  MARKET_BUDGET_MULTIPLIER_SMALL,
  SEASONS_PER_STRETCH_BIG,
  SEASONS_PER_STRETCH_MID,
  SEASONS_PER_STRETCH_SMALL,
} from './constants'

export type MarketSizeId = 'big' | 'mid' | 'small'

export interface MarketSize {
  id: MarketSizeId
  label: string
  description: string
  budgetMultiplier: number
  seasonsPerStretch: number
}

/** Imposed at run start, not drafted (Section 8's "things happening to you" category) -- unlike
 *  the roster-quirk/house-rule draft, there's no choice here, just a random hand. */
export const MARKET_SIZES: Record<MarketSizeId, MarketSize> = {
  big: {
    id: 'big',
    label: 'Big Market',
    description: 'Most cash, least patience -- ownership wants results now.',
    budgetMultiplier: MARKET_BUDGET_MULTIPLIER_BIG,
    seasonsPerStretch: SEASONS_PER_STRETCH_BIG,
  },
  mid: {
    id: 'mid',
    label: 'Mid Market',
    description: 'A balance of cash and patience.',
    budgetMultiplier: MARKET_BUDGET_MULTIPLIER_MID,
    seasonsPerStretch: SEASONS_PER_STRETCH_MID,
  },
  small: {
    id: 'small',
    label: 'Small Market',
    description: 'Least cash, most patience -- the fans stick with a rebuild.',
    budgetMultiplier: MARKET_BUDGET_MULTIPLIER_SMALL,
    seasonsPerStretch: SEASONS_PER_STRETCH_SMALL,
  },
}

export function pickRandomMarketSize(rng: Rng): MarketSizeId {
  const ids = Object.keys(MARKET_SIZES) as MarketSizeId[]
  return ids[Math.floor(rng() * ids.length)]
}
