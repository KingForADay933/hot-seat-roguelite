import type { AttributeKey } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { PLAYER_CAMP_COST, TEAM_CAMP_COST } from '../../run/constants'
import { CampPurchaseForm } from '../components/CampPurchaseForm'

export function ShopScreen({
  bundle,
  onBuyPlayerCamp,
  onBuyTeamCamp,
  onContinue,
}: {
  bundle: RunBundle
  onBuyPlayerCamp: (playerId: string, attribute: AttributeKey) => void
  onBuyTeamCamp: (attribute: AttributeKey) => void
  onContinue: () => void
}) {
  const { run, players, shop } = bundle
  if (!shop) return null

  const roster = players.filter((p) => p.teamId === run.teamId)
  const nothingLeftToBuy = shop.playerCampsRemaining <= 0 && shop.teamCampsRemaining <= 0

  return (
    <main>
      <h1>{shop.tier === 'expanded' ? 'Expanded Shop' : 'Shop'}</h1>
      <p>
        {shop.tier === 'expanded'
          ? 'Stretch cleared -- a bigger, pricier hand this visit.'
          : 'A quick, cheap look before the next season.'}
      </p>
      <p>Budget: ${run.budget}</p>

      <CampPurchaseForm
        title="Send a Player to Camp"
        description="Pick the player and the attribute -- a bounded random boost lands there."
        cost={PLAYER_CAMP_COST}
        remaining={shop.playerCampsRemaining}
        budget={run.budget}
        players={roster}
        onBuy={(attribute, playerId) => playerId && onBuyPlayerCamp(playerId, attribute)}
      />

      <CampPurchaseForm
        title="Whole-Team Camp"
        description="Sends the entire roster to camp for a smaller boost to one attribute, spread across everyone."
        cost={TEAM_CAMP_COST}
        remaining={shop.teamCampsRemaining}
        budget={run.budget}
        onBuy={(attribute) => onBuyTeamCamp(attribute)}
      />

      {nothingLeftToBuy && <p>Nothing left to buy this visit.</p>}

      <p>
        <button className="primary" onClick={onContinue}>
          Sim Next Season
        </button>
      </p>
    </main>
  )
}
