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
    <button type="button" className="draft-option" disabled={!affordable} onClick={onBuy}>
      <strong>{upgrade.label}</strong>
      <p>{upgrade.description}</p>
      <p>${cost}</p>
    </button>
  )
}
