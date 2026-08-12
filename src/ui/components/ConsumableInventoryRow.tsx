import type { Consumable } from '../../run/consumables'

/** One held-but-unspent consumable (Section 8.7) -- the "loadout" half of the Consumables section:
 *  burns this instance for the season about to start. Separate from ConsumableCard since this
 *  activates inventory rather than buying into it. */
export function ConsumableInventoryRow({
  consumable,
  onActivate,
  blockedReason,
}: {
  consumable: Consumable
  onActivate: () => void
  /** Why this one can't be burned right now, from run/consumables/activation.ts. Shown rather than
   *  merely disabling the button: a card you paid for that refuses to work without saying why reads
   *  as a broken control, and the reason here ("already cashed this season") is also the answer to
   *  "should I have bought this", which the GM can still act on by holding it. */
  blockedReason?: string | null
}) {
  // A row, not a panel. These are rendered inside a Section, and the nested grey box this used to be
  // put a container inside a container inside a container -- three borders deep for one consumable.
  return (
    <div className="loadout-row">
      <span className="loadout-row-text">
        <strong>{consumable.label}</strong>
        <span className="loadout-row-desc">{consumable.description}</span>
        {blockedReason && <span className="shop-card-blocked">{blockedReason}</span>}
      </span>
      <button type="button" onClick={onActivate} disabled={Boolean(blockedReason)} title={blockedReason ?? undefined}>
        Use Next Season
      </button>
    </div>
  )
}
