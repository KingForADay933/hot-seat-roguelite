import type { Consumable } from '../../run/consumables'

/** One rolled consumable offer (Section 8.7) -- an immediate buy button into inventory, same
 *  shape as CoachingUpgradeCard. Unlike that card, buying doesn't remove the offer (duplicates in
 *  inventory are fine) -- `canBuy` folds in both budget AND the 3-slot inventory cap, since either
 *  one blocks a purchase here. */
export function ConsumableCard({
  consumable,
  cost,
  canBuy,
  onBuy,
}: {
  consumable: Consumable
  cost: number
  canBuy: boolean
  onBuy: () => void
}) {
  return (
    <button type="button" className="draft-option" disabled={!canBuy} onClick={onBuy}>
      <strong>{consumable.label}</strong>
      <p>{consumable.description}</p>
      <p>${cost}</p>
    </button>
  )
}
