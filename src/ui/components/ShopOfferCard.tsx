import type { ShopOffer } from '../../run/shop'

export function ShopOfferCard({
  offer,
  playerName,
  affordable,
  onBuy,
}: {
  offer: ShopOffer
  /** The camp's target player name; null for a team-camp offer. */
  playerName: string | null
  affordable: boolean
  onBuy: () => void
}) {
  const label = offer.type === 'team-camp' ? 'Whole-Team Camp' : `${playerName} — Camp`
  const description =
    offer.type === 'team-camp'
      ? 'Sends the entire roster to camp for a smaller attribute boost spread across everyone.'
      : 'Sends this player to camp for a bounded random attribute boost.'

  return (
    <button type="button" className="draft-option" disabled={!affordable} onClick={onBuy}>
      <strong>{label}</strong>
      <p>{description}</p>
      <p>${offer.cost}</p>
    </button>
  )
}
