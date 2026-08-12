import type { Consumable } from '../../run/consumables'

/** One rolled consumable offer (Section 8.7) -- an immediate buy button into inventory, same
 *  shape as CoachingUpgradeCard. Unlike that card, buying doesn't remove the offer (duplicates in
 *  inventory are fine) -- `canBuy` folds in both budget AND the 3-slot inventory cap, since either
 *  one blocks a purchase here. */
export function ConsumableCard({
  consumable,
  cost,
  canBuy,
  blockedReason,
  onBuy,
}: {
  consumable: Consumable
  cost: number
  canBuy: boolean
  /** Why it can't be bought, when it can't. Shown rather than left to a greyed-out button, for the
   *  same reason ConsumableInventoryRow shows its own: "inventory full" and "not enough budget" are
   *  different problems with different answers, and a dimmed card that says neither reads as broken.
   *  Ignored while `canBuy` is true. */
  blockedReason?: string | null
  onBuy: () => void
}) {
  return (
    <button type="button" className="draft-option shop-card" disabled={!canBuy} onClick={onBuy}>
      <span className="shop-card-head">
        <strong>{consumable.label}</strong>
        <span className="price-tag">${cost}</span>
      </span>
      <p>{consumable.description}</p>
      {!canBuy && blockedReason && <p className="shop-card-blocked">{blockedReason}</p>}
    </button>
  )
}
