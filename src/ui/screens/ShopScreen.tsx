import type { AttributeKey } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { COACHING_UPGRADES, type CoachingUpgradeId } from '../../run/coachingUpgrades'
import { COACHING_UPGRADE_COST, CONSUMABLE_COST, CONSUMABLE_INVENTORY_CAPACITY, PLAYER_CAMP_COST, TEAM_CAMP_COST } from '../../run/constants'
import { CONSUMABLES, type ConsumableId } from '../../run/consumables'
import { CampPurchaseForm } from '../components/CampPurchaseForm'
import { CoachingUpgradeCard } from '../components/CoachingUpgradeCard'
import { ConsumableCard } from '../components/ConsumableCard'
import { ConsumableInventoryRow } from '../components/ConsumableInventoryRow'

export function ShopScreen({
  bundle,
  onBuyPlayerCamp,
  onBuyTeamCamp,
  onBuyCoachingUpgrade,
  onRerollUpgradeOffers,
  onBuyConsumable,
  onRerollConsumableOffers,
  onActivateConsumable,
  onContinue,
  onSimSeason,
}: {
  bundle: RunBundle
  onBuyPlayerCamp: (playerId: string, attribute: AttributeKey) => void
  onBuyTeamCamp: (attribute: AttributeKey) => void
  onBuyCoachingUpgrade: (upgradeId: CoachingUpgradeId) => void
  onRerollUpgradeOffers: () => void
  onBuyConsumable: (consumableId: ConsumableId) => void
  onRerollConsumableOffers: () => void
  onActivateConsumable: (consumableId: ConsumableId) => void
  onContinue: () => void
  onSimSeason: () => void
}) {
  const { run, players, shop } = bundle
  if (!shop) return null

  const roster = players.filter((p) => p.teamId === run.teamId)
  const inventoryFull = run.consumableInventory.length >= CONSUMABLE_INVENTORY_CAPACITY
  const canBuyConsumable = !inventoryFull && run.budget >= CONSUMABLE_COST
  const nothingLeftToBuy =
    shop.playerCampsRemaining <= 0 && shop.teamCampsRemaining <= 0 && shop.upgradeOffers.length === 0 && shop.consumableOffers.length === 0

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

      {shop.upgradeOffers.length > 0 && (
        <div className="team-summary">
          <strong>Coaching Upgrades</strong>
          <p>Permanent for the rest of the run -- each card can only be bought once.</p>
          <div className="draft-options">
            {shop.upgradeOffers.map((upgradeId) => (
              <CoachingUpgradeCard
                key={upgradeId}
                upgrade={COACHING_UPGRADES[upgradeId]}
                cost={COACHING_UPGRADE_COST}
                affordable={run.budget >= COACHING_UPGRADE_COST}
                onBuy={() => onBuyCoachingUpgrade(upgradeId)}
              />
            ))}
          </div>
          {shop.upgradeRerollsRemaining > 0 && (
            <button onClick={onRerollUpgradeOffers}>Reroll Upgrade Offers ({shop.upgradeRerollsRemaining} left)</button>
          )}
        </div>
      )}

      {run.coachingUpgrades.length > 0 && (
        <div className="team-summary">
          <strong>Coaching Staff</strong>
          <p>{run.coachingUpgrades.map((id) => COACHING_UPGRADES[id].label).join(', ')}</p>
        </div>
      )}

      {shop.consumableOffers.length > 0 && (
        <div className="team-summary">
          <strong>Consumables</strong>
          <p>
            Cheap, single-season boosts -- held in inventory ({run.consumableInventory.length}/{CONSUMABLE_INVENTORY_CAPACITY}) until you burn
            them for a season below.
          </p>
          <div className="draft-options">
            {shop.consumableOffers.map((consumableId, i) => (
              <ConsumableCard
                key={`${consumableId}-${i}`}
                consumable={CONSUMABLES[consumableId]}
                cost={CONSUMABLE_COST}
                canBuy={canBuyConsumable}
                onBuy={() => onBuyConsumable(consumableId)}
              />
            ))}
          </div>
          {shop.consumableRerollsRemaining > 0 && (
            <button onClick={onRerollConsumableOffers}>Reroll Consumable Offers ({shop.consumableRerollsRemaining} left)</button>
          )}
        </div>
      )}

      {run.consumableInventory.length > 0 && (
        <div className="team-summary">
          <strong>Loadout -- Burn Before Next Season</strong>
          <p>Pick 0-3 to activate for the upcoming season. Whatever's left stays banked for later.</p>
          {run.consumableInventory.map((consumableId, i) => (
            <ConsumableInventoryRow
              key={`${consumableId}-${i}`}
              consumable={CONSUMABLES[consumableId]}
              onActivate={() => onActivateConsumable(consumableId)}
            />
          ))}
        </div>
      )}

      {run.activeConsumablesThisSeason.length > 0 && (
        <div className="team-summary">
          <strong>Active Next Season</strong>
          <p>{run.activeConsumablesThisSeason.map((id) => CONSUMABLES[id].label).join(', ')}</p>
        </div>
      )}

      {nothingLeftToBuy && <p>Nothing left to buy this visit.</p>}

      <div className="stretch-actions">
        <button className="primary" onClick={onContinue}>
          Start Next Season
        </button>
        <button onClick={onSimSeason}>Sim First Stretch</button>
      </div>
    </main>
  )
}
