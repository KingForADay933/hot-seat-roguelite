import { createContext } from 'react'
import type { AttributeKey, League, Player, PlayerId, Team, TeamId } from '../../data/types'
import type { SystemId } from '../../data/presets'
import type { RunBundle } from '../../data/persistence/runRepository'
import type { CoachingUpgradeId } from '../../run/coachingUpgrades'
import type { ConsumableId } from '../../run/consumables'
import type { MarketSizeId } from '../../run/marketSize'
import type { HouseRuleId } from '../../run/variation/houseRules'
import type { RosterQuirkId } from '../../run/variation/rosterQuirks'

/** A league/team has been generated and the user's team picked, but the roster-quirk/house-rule
 *  draft hasn't been resolved yet -- not a real run until confirmDraft applies the choices.
 *  Held only in memory (not persisted): losing an in-progress draft to a refresh just means
 *  re-rolling, same cost as clicking "Start New Run" again.
 *
 *  The system draft deliberately is NOT here: quirk and house rule *mutate* the roster (attribute
 *  shifts, roster cuts), so they have to be locked in before the roster can be shown, whereas a
 *  system only ever scores against a finished roster. Choosing one blind was asking the GM to bet
 *  on a team they hadn't seen -- it now happens on the reveal screen instead (see PendingReveal). */
export interface PendingDraft {
  league: League
  teams: Team[]
  players: Player[]
  teamId: TeamId
  rosterQuirkOptions: RosterQuirkId[]
  houseRuleOptions: HouseRuleId[]
  /** Rolled (not drafted) alongside the league -- Section 8.1 is imposed, no player choice. */
  marketSize: MarketSizeId
}

/** Phase two of run setup: the roster is final (quirk and house rule already applied to `teams`/
 *  `players`) and on display, but no system has been chosen, so there's still no run to persist.
 *  Held only in memory for the same reason as PendingDraft -- a refresh here costs the two picks
 *  already made, not simulated progress. */
export interface PendingReveal {
  league: League
  teams: Team[]
  players: Player[]
  teamId: TeamId
  rosterQuirk: RosterQuirkId
  houseRule: HouseRuleId
  marketSize: MarketSizeId
  systemOptions: SystemId[]
}

export interface RunContextValue {
  bundle: RunBundle | null
  draft: PendingDraft | null
  reveal: PendingReveal | null
  loading: boolean
  /** Whether the results screen for the season that ended a fired run has been continued past yet.
   *  Held only in memory (not persisted, same rationale as PendingDraft above): the fired run's
   *  final Season Results screen shows once (see App.tsx), and losing this flag to a refresh just
   *  means it shows again, not a real loss of progress. Reset to false by beginDraft. */
  fireAcknowledged: boolean
  /** Continues past a fired run's final Season Results screen to the Fired screen -- the shop-less
   *  equivalent of openShop for a run that's over. */
  acknowledgeFired: () => void
  beginDraft: () => Promise<void>
  /** Resolves phase one of setup: applies the chosen quirk and house rule to the roster and rolls
   *  the system candidates, moving to the reveal (still nothing persisted -- see PendingReveal). */
  confirmDraft: (rosterQuirk: RosterQuirkId, houseRule: HouseRuleId) => Promise<void>
  /** Resolves phase two: scores the chosen system against the now-visible roster, writes it and the
   *  resulting synergy onto the team, and persists the run for real. */
  lockSystem: (system: SystemId) => Promise<void>
  /** Simulates the next chunk of the current season (or a fresh season's first chunk) -- Section
   *  9. The resulting bundle tells the caller which screen comes next (chunk checkpoint vs. the
   *  season-end results screen) via run.chunkInSeason. */
  simSeasonChunk: () => Promise<void>
  /** GM adjustment available at a chunk checkpoint (Section 9): overrides one player's target
   *  minutes (clamped 0-48) for the rest of the season. */
  setRotationMinutes: (playerId: PlayerId, minutes: number) => Promise<void>
  /** GM adjustment available at a chunk checkpoint: sets (or, given null, clears back to
   *  auto-computed) one player's training focus to a single attribute. */
  setTrainingFocus: (playerId: PlayerId, attribute: AttributeKey | null) => Promise<void>
  /** Opens this season's shop visit (Section 8.4) -- tier picked from lastSeasonTargetHit. */
  openShop: () => Promise<void>
  /** Sends one freely-chosen roster player to camp for a boost to one freely-chosen attribute
   *  (Section 8.5): spends budget, applies the camp, consumes one of the visit's
   *  playerCampsRemaining. No-ops if the visit is out of player-camp purchases or budget. */
  buyPlayerCamp: (playerId: PlayerId, attribute: AttributeKey) => Promise<void>
  /** Same as buyPlayerCamp but for the whole roster at once (expanded tier only), targeting one
   *  attribute across every player. Consumes one of the visit's teamCampsRemaining. */
  buyTeamCamp: (attribute: AttributeKey) => Promise<void>
  /** Buys one coaching-upgrade card (Section 8.6) from the visit's rolled upgradeOffers: spends
   *  COACHING_UPGRADE_COST, applies its permanent effect, and adds it to run.coachingUpgrades for
   *  good. No-ops if the id isn't currently offered, is already owned, or budget is short. */
  buyCoachingUpgrade: (upgradeId: CoachingUpgradeId) => Promise<void>
  /** Reshuffles the visit's coaching-upgrade offers, consuming one of upgradeRerollsRemaining
   *  (expanded tier only). No-ops at 0 remaining. */
  rerollUpgradeOffers: () => Promise<void>
  /** Buys one consumable card (Section 8.7) from the visit's rolled consumableOffers into
   *  run.consumableInventory: spends CONSUMABLE_COST. Unlike buyCoachingUpgrade, the bought id
   *  stays offered (duplicates in inventory are fine) and this no-ops once the 3-slot inventory
   *  (CONSUMABLE_INVENTORY_CAPACITY) is full, regardless of budget. */
  buyConsumable: (consumableId: ConsumableId) => Promise<void>
  /** Reshuffles the visit's consumable offers, consuming one of consumableRerollsRemaining
   *  (expanded tier only, independent of upgradeRerollsRemaining). No-ops at 0 remaining. */
  rerollConsumableOffers: () => Promise<void>
  /** Burns one held consumable for the upcoming season (Section 8.7's pre-season "loadout" step):
   *  moves one instance from run.consumableInventory to run.activeConsumablesThisSeason, where
   *  simulateSeasonChunk picks it up for every chunk of that season. No-ops if none are held. */
  activateConsumable: (consumableId: ConsumableId) => Promise<void>
}

export const RunContext = createContext<RunContextValue | null>(null)
