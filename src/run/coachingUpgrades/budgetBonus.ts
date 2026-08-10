import { FAN_CULTURE_BUY_IN_SEASON_BONUS } from '../constants'
import type { CoachingUpgradeId } from './catalog'

/**
 * Flat addition to a season's budget earnings from owned coaching upgrades, before the market
 * multiplier -- the sibling of computeSynergyUpgradeBonus, and derived the same way for the same
 * reason: read fresh from run.coachingUpgrades every time earnings are computed (run/budget.ts),
 * never written to run.budget at purchase time.
 *
 * That distinction is the whole safety property here. This is the only upgrade whose reward is
 * denominated in the same currency as its own price, which is what made the Energy Drink Sponsorship
 * a money pump. It cannot loop -- an upgrade leaves the offer pool once owned and can only be bought
 * once -- but paying out at purchase would still turn a permanent raise into a one-time lump, which
 * is just a worse copy of a card that already exists.
 */
export function computeBudgetUpgradeBonus(owned: CoachingUpgradeId[]): number {
  return owned.includes('fan-culture-buy-in') ? FAN_CULTURE_BUY_IN_SEASON_BONUS : 0
}
