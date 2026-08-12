import type { CoachingUpgrade } from '../../run/coachingUpgrades'

/** One rolled coaching-upgrade offer (Section 8.6) -- an immediate buy button, not a pick-one-of-
 *  N-then-confirm draft, mirroring the pre-Phase-7-rework shop's ShopOfferCard rather than
 *  DraftOptionCard's radio-style selection. */
export function CoachingUpgradeCard({
  upgrade,
  cost,
  affordable,
  onBuy,
}: {
  upgrade: CoachingUpgrade
  cost: number
  affordable: boolean
  onBuy: () => void
}) {
  return (
    <button type="button" className="draft-option shop-card" disabled={!affordable} onClick={onBuy}>
      <span className="shop-card-head">
        <strong>{upgrade.label}</strong>
        <span className="price-tag">${cost}</span>
      </span>
      <p>{upgrade.description}</p>
      {!affordable && <p className="shop-card-blocked">Not enough budget</p>}
    </button>
  )
}
