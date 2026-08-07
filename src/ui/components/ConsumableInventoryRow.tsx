import type { Consumable } from '../../run/consumables'

/** One held-but-unspent consumable (Section 8.7) -- the "loadout" half of the Consumables section:
 *  burns this instance for the season about to start. Separate from ConsumableCard since this
 *  activates inventory rather than buying into it. */
export function ConsumableInventoryRow({ consumable, onActivate }: { consumable: Consumable; onActivate: () => void }) {
  return (
    <div className="team-summary">
      <strong>{consumable.label}</strong>
      <p>{consumable.description}</p>
      <button type="button" onClick={onActivate}>
        Use Next Season
      </button>
    </div>
  )
}
