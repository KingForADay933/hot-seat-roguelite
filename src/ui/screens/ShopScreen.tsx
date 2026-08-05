import type { RunBundle } from '../../data/persistence/runRepository'
import { ShopOfferCard } from '../components/ShopOfferCard'

export function ShopScreen({
  bundle,
  onBuy,
  onReroll,
  onContinue,
}: {
  bundle: RunBundle
  onBuy: (offerId: string) => void
  onReroll: () => void
  onContinue: () => void
}) {
  const { run, players, shop } = bundle
  if (!shop) return null

  const playersById = new Map(players.map((p) => [p.id, p]))

  return (
    <main>
      <h1>{shop.tier === 'expanded' ? 'Expanded Shop' : 'Shop'}</h1>
      <p>
        {shop.tier === 'expanded'
          ? 'Stretch cleared -- a bigger, pricier hand this visit, plus a reroll.'
          : 'A quick, cheap look before the next season.'}
      </p>
      <p>Budget: ${run.budget}</p>

      <div className="draft-options">
        {shop.offers.map((offer) => (
          <ShopOfferCard
            key={offer.id}
            offer={offer}
            playerName={offer.playerId ? (playersById.get(offer.playerId)?.name ?? null) : null}
            affordable={run.budget >= offer.cost}
            onBuy={() => onBuy(offer.id)}
          />
        ))}
        {shop.offers.length === 0 && <p>Nothing left to buy this visit.</p>}
      </div>

      {shop.rerollsRemaining > 0 && <button onClick={onReroll}>Reroll Offers ({shop.rerollsRemaining} left)</button>}

      <p>
        <button className="primary" onClick={onContinue}>
          Sim Next Season
        </button>
      </p>
    </main>
  )
}
