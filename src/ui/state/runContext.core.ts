import { createContext } from 'react'
import type { AttributeKey, Game, GameId, League, Player, PlayerId, RotationPlan, TacticalFocus, Team, TeamId } from '../../data/types'
import type { DefensiveSchemeId, SystemId } from '../../data/presets'
import type { RunBundle } from '../../data/persistence/runRepository'
import type { ChunkSimContext } from '../../run/chunkSimContext'
import type { CoachingUpgradeId } from '../../run/coachingUpgrades'
import type { ConsumableId } from '../../run/consumables'
import type { MarketSizeId } from '../../run/marketSize'
import type { OnboardingSpotId } from '../../run/onboarding'
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

/** A stretch game the GM chose to watch, currently being played out possession by possession on the
 *  simcast screen. Held only in memory (not persisted, same rationale as PendingDraft above): the
 *  game isn't committed until its final buzzer, so losing this to a refresh leaves it unplayed and
 *  re-watchable rather than half-recorded. */
export interface LiveGame {
  /** The still-unplayed scheduled game -- teams and date for the scoreboard. */
  game: Game
  /** Captured when the watch began so the live game simulates under exactly the same
   *  consumable-boosted rosters simGame would have used. */
  context: ChunkSimContext
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
  /** Non-null only while a game is actually being watched -- what App routes the simcast screen on. */
  liveGame: LiveGame | null
  /** Continues past a fired run's final Season Results screen to the Fired screen -- the shop-less
   *  equivalent of openShop for a run that's over. */
  acknowledgeFired: () => void
  /** Quits the run in progress and returns to the start screen, deleting the save. Distinct from
   *  beginDraft, which also erases but then immediately rolls the next run's draft -- quitting and
   *  starting again are separate acts. Nothing is retained; there's no run history to write to. */
  abandonRun: () => Promise<void>
  beginDraft: () => Promise<void>
  /** Resolves phase one of setup: applies the chosen quirk and house rule to the roster and rolls
   *  the system candidates, moving to the reveal (still nothing persisted -- see PendingReveal). */
  confirmDraft: (rosterQuirk: RosterQuirkId, houseRule: HouseRuleId) => Promise<void>
  /** Resolves phase two: scores the chosen system against the now-visible roster, writes it and the
   *  resulting synergy onto the team, and persists the run for real. */
  lockSystem: (system: SystemId, defense: DefensiveSchemeId) => Promise<void>
  /** Simulates the next chunk of the current season (or a fresh season's first chunk) in one go --
   *  Section 9. The "just sim it" path, skipping the stretch screen entirely; the resulting bundle
   *  tells the caller which screen comes next (chunk checkpoint vs. the season-end results screen)
   *  via run.chunkInSeason. */
  simSeasonChunk: () => Promise<void>
  /** Opens the stretch screen for the next chunk instead of simming it outright: generates the
   *  season if this is its first chunk, plays the chunk's AI-vs-AI games, and leaves the GM's own
   *  games for them to resolve individually. No-ops if a stretch is already open. */
  beginStretch: () => Promise<void>
  /** Resolves one of the open stretch's games outright, no simcast. No-ops on an unknown id or one
   *  that's already been played. */
  simGame: (gameId: GameId) => Promise<void>
  /** Opens one of the open stretch's games on the simcast screen to be played out live. Same
   *  no-ops as simGame; commits nothing on its own. */
  watchGame: (gameId: GameId) => void
  /** Banks a game the GM watched to its final buzzer, exactly as simulated on the simcast screen
   *  rather than re-rolled. Clears liveGame either way. */
  commitLiveGame: (played: Game) => Promise<void>
  /** Leaves a simcast before the final buzzer. Nothing is committed -- the game goes back to being
   *  unplayed on the stretch screen, and watching again starts it over as a different game. */
  abandonLiveGame: () => void
  /** Closes the open stretch: sims any games the GM left unresolved, then runs the chunk through
   *  finalizeChunk to the checkpoint. Valid with any number of games remaining, so it doubles as
   *  "sim the rest." */
  finishStretch: () => Promise<void>
  /** GM adjustment available at a chunk checkpoint (Section 9): overrides one player's target
   *  minutes (clamped 0-48) for the rest of the season. */
  setRotationMinutes: (playerId: PlayerId, minutes: number) => Promise<void>
  /** GM adjustment available at a chunk checkpoint: sets (or, given null, clears back to
   *  auto-computed) one player's training focus to a single attribute. */
  setTrainingFocus: (playerId: PlayerId, attribute: AttributeKey | null) => Promise<void>
  /** The team's standing defensive scheme. Changeable at any point in a run -- from a checkpoint,
   *  from My Team, or mid-broadcast -- and persists in every case. */
  setDefensiveScheme: (schemeId: DefensiveSchemeId) => Promise<void>
  /** One or more of the team's standing tactical dials. Same lifecycle as the defensive scheme above
   *  -- checkpoint, My Team or mid-broadcast, always persisted -- but unlike it, this recomputes
   *  synergy, because shot selection changes the play-call mix synergy scores the roster against.
   *  Partial so a control can set the one dial it owns without restating the other three. */
  setTacticalFocus: (focus: Partial<TacticalFocus>) => Promise<void>
  /** Replaces the user's team's whole rotation chart (rotation-charts.md Phase G) -- the editor
   *  computes the new plan (split/merge/move-boundary/reassign are all pure functions over the old
   *  one, see run/rotationChart.ts) and this just persists it. Does not recompute synergy: the
   *  system-fit projection still reads rotationMinutes, not the chart (Phase F's deliberate
   *  deferral), so a chart-only edit has nothing new for that recompute to see yet. */
  setRotationPlan: (plan: RotationPlan) => Promise<void>
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
  /** Records that the GM has found one of the onboarding spots (run/onboarding.ts). Called from the
   *  hint components on mount, so it no-ops when the spot is already recorded rather than writing on
   *  every revisit. */
  markOnboardingSeen: (spot: OnboardingSpotId) => Promise<void>
  /** Records every checklist spot at once, for a returning player who does not need orienting. */
  skipOnboarding: () => Promise<void>
}

export const RunContext = createContext<RunContextValue | null>(null)
