import type { RunState } from '../types'
import type { ConsumableId } from './catalog'

/**
 * Consumables that pay out in budget rather than in a rating the simulation reads.
 *
 * The distinction matters because it is the only case where a card's reward is denominated in the
 * same currency as its own price, which makes it a money pump the moment it can be cashed more than
 * once: buy for CONSUMABLE_COST, cash for more than that, buy again with the proceeds, repeat. Every
 * other card converts budget into something you cannot spend at the shop, so repeating it just costs
 * money -- which is why buying duplicates stays allowed and why stacked effects are fine.
 */
const BUDGET_PAYOUT_CONSUMABLES: ConsumableId[] = ['energy-drink-sponsorship']

export function isBudgetPayoutConsumable(consumableId: ConsumableId): boolean {
  return BUDGET_PAYOUT_CONSUMABLES.includes(consumableId)
}

/**
 * Why this held consumable cannot be burned right now, or null if it can.
 *
 * One rule, and it exists to close an infinite-money loop rather than to express a design idea: a
 * budget-paying card cashes **once a season**. Activation and purchase both happen inside the same
 * shop visit, and the payout landed on `run.budget` immediately, so without this a GM could buy and
 * cash the Energy Drink Sponsorship in a loop and net the difference every time, forever.
 *
 * A season is the scope because `activeConsumablesThisSeason` already resets on one (run/runState.ts),
 * so the rule needs no new state to be true -- and because a shop visit *is* once a season, capping
 * per season and capping per visit are the same cap.
 *
 * Deliberately not a rule about buying. Holding a second sponsorship for next season is a perfectly
 * reasonable thing to do with a shop slot, and blocking the purchase would take that away to fix a
 * problem that only exists at the moment of cashing.
 *
 * Returned as a sentence rather than a boolean so the shop can say why the button is disabled.
 * A control that silently does nothing is the other way to lose 100 budget to this card.
 */
export function consumableActivationBlockedReason(consumableId: ConsumableId, run: RunState): string | null {
  if (!isBudgetPayoutConsumable(consumableId)) return null
  if (!run.activeConsumablesThisSeason.includes(consumableId)) return null
  return 'Already cashed this season -- a sponsorship pays out once. This one keeps until next season.'
}
