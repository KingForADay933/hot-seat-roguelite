import type { AttributeKey } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { COACHING_UPGRADES, type CoachingUpgradeId } from '../../run/coachingUpgrades'
import { COACHING_UPGRADE_COST, CONSUMABLE_COST, CONSUMABLE_INVENTORY_CAPACITY, PLAYER_CAMP_COST, TEAM_CAMP_COST } from '../../run/constants'
import { CONSUMABLES, consumableActivationBlockedReason, type ConsumableId } from '../../run/consumables'
import { CampPurchaseForm } from '../components/CampPurchaseForm'
import { CoachingUpgradeCard } from '../components/CoachingUpgradeCard'
import { ConsumableCard } from '../components/ConsumableCard'
import { ConsumableInventoryRow } from '../components/ConsumableInventoryRow'
import { ScreenActions } from '../components/ScreenActions'
import { Section } from '../components/Section'
import { StatCallouts } from '../components/StatCallouts'
import { splitRoster } from '../rosterGroups'

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
  const { run, teams, players, shop } = bundle
  if (!shop) return null

  const team = teams.find((t) => t.id === run.teamId)
  const roster = players.filter((p) => p.teamId === run.teamId)
  // Starters first, then bench -- same split the roster screens use, so the camp dropdown lists
  // players in the order a GM already thinks about them.
  const { starters, bench } = team ? splitRoster(team, roster) : { starters: [], bench: roster }
  const campTargets = [
    { label: 'Starting Five', players: starters },
    { label: 'Bench', players: bench },
  ]
  const inventoryFull = run.consumableInventory.length >= CONSUMABLE_INVENTORY_CAPACITY
  const canBuyConsumable = !inventoryFull && run.budget >= CONSUMABLE_COST
  const nothingLeftToBuy =
    shop.playerCampsRemaining <= 0 && shop.teamCampsRemaining <= 0 && shop.upgradeOffers.length === 0 && shop.consumableOffers.length === 0

  return (
    <main>
      <ScreenActions>
        <button className="primary" onClick={onContinue}>
          Start Next Season
        </button>
        <button onClick={onSimSeason}>Sim First Stretch</button>
      </ScreenActions>

      <h1>{shop.tier === 'expanded' ? 'Expanded Shop' : 'Shop'}</h1>
      <p className="screen-lede">
        {shop.tier === 'expanded'
          ? 'Stretch cleared -- a bigger, pricier hand this visit.'
          : 'A quick, cheap look before the next season.'}
      </p>

      {/* Budget leads, because it is the constraint every other control on this screen is measured
          against -- it used to be a bare sentence between two forms. The remaining counts sit beside
          it for the same reason: "two player camps left" is what decides whether to spend now. */}
      <StatCallouts
        items={[
          { label: 'Budget', value: `$${run.budget}` },
          shop.playerCampsRemaining > 0 && { label: `Player camps · $${PLAYER_CAMP_COST}`, value: shop.playerCampsRemaining },
          shop.teamCampsRemaining > 0 && { label: `Team camps · $${TEAM_CAMP_COST}`, value: shop.teamCampsRemaining },
          {
            label: 'Consumables held',
            value: `${run.consumableInventory.length}/${CONSUMABLE_INVENTORY_CAPACITY}`,
            tone: inventoryFull ? 'negative' : undefined,
          },
        ]}
      />

      {nothingLeftToBuy && <p className="section-note">Nothing left to buy this visit.</p>}

      {/* What you can spend on, and what you already have. The loadout sits on the owned side even
          though activating is an action -- it is an action about your stuff, and keeping it beside
          the staff list is what makes "what am I taking into next season" one glance. */}
      <div className="screen-columns">
        <div>
          {(shop.playerCampsRemaining > 0 || shop.teamCampsRemaining > 0) && (
            <Section title="Camps" summary="a bounded boost to one attribute" defaultOpen>
              <CampPurchaseForm
                title="Send a Player to Camp"
                description="Pick the player and the attribute -- a bounded random boost lands there."
                cost={PLAYER_CAMP_COST}
                remaining={shop.playerCampsRemaining}
                budget={run.budget}
                playerGroups={campTargets}
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
            </Section>
          )}

          {shop.upgradeOffers.length > 0 && (
            <Section title="Coaching Upgrades" summary={`${shop.upgradeOffers.length} offered · $${COACHING_UPGRADE_COST}`} defaultOpen>
              <p className="section-note">Permanent for the rest of the run -- each card can only be bought once.</p>
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
                <button onClick={onRerollUpgradeOffers}>Reroll for a different hand ({shop.upgradeRerollsRemaining} left)</button>
              )}
            </Section>
          )}

          {shop.consumableOffers.length > 0 && (
            <Section title="Consumables" summary={`${shop.consumableOffers.length} offered · $${CONSUMABLE_COST}`} defaultOpen>
              <p className="section-note">
                Cheap, single-season boosts. Buying puts one in your inventory; it does nothing until you burn it for a
                season under Loadout.
              </p>
              <div className="draft-options">
                {shop.consumableOffers.map((consumableId, i) => (
                  <ConsumableCard
                    key={`${consumableId}-${i}`}
                    consumable={CONSUMABLES[consumableId]}
                    cost={CONSUMABLE_COST}
                    canBuy={canBuyConsumable}
                    blockedReason={inventoryFull ? 'Inventory full' : run.budget < CONSUMABLE_COST ? 'Not enough budget' : null}
                    onBuy={() => onBuyConsumable(consumableId)}
                  />
                ))}
              </div>
              {shop.consumableRerollsRemaining > 0 && (
                <button onClick={onRerollConsumableOffers}>Reroll for a different hand ({shop.consumableRerollsRemaining} left)</button>
              )}
            </Section>
          )}
        </div>

        <div>
          {run.consumableInventory.length > 0 && (
            <Section title="Loadout" summary={`${run.consumableInventory.length} held, unspent`} defaultOpen>
              <p className="section-note">Burn as many as you like for the season about to start. Whatever is left stays banked.</p>
              {run.consumableInventory.map((consumableId, i) => (
                <ConsumableInventoryRow
                  key={`${consumableId}-${i}`}
                  consumable={CONSUMABLES[consumableId]}
                  blockedReason={consumableActivationBlockedReason(consumableId, run)}
                  onActivate={() => onActivateConsumable(consumableId)}
                />
              ))}
            </Section>
          )}

          {run.activeConsumablesThisSeason.length > 0 && (
            <Section title="Active Next Season" summary={`${run.activeConsumablesThisSeason.length} burned`} defaultOpen>
              <ul className="shop-owned">
                {run.activeConsumablesThisSeason.map((id, i) => (
                  <li key={`${id}-${i}`}>{CONSUMABLES[id].label}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title="Coaching Staff"
            summary={run.coachingUpgrades.length > 0 ? `${run.coachingUpgrades.length} owned` : 'none bought'}
          >
            {run.coachingUpgrades.length > 0 ? (
              <ul className="shop-owned">
                {run.coachingUpgrades.map((id) => (
                  <li key={id}>
                    <strong>{COACHING_UPGRADES[id].label}</strong> -- {COACHING_UPGRADES[id].description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="section-note">Nothing bought yet. These are permanent for the rest of the run.</p>
            )}
          </Section>
        </div>
      </div>
    </main>
  )
}
