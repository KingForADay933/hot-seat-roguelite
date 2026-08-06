import { createContext } from 'react'
import type { AttributeKey, League, Player, PlayerId, Team, TeamId } from '../../data/types'
import type { SystemId } from '../../data/presets'
import type { RunBundle } from '../../data/persistence/runRepository'
import type { MarketSizeId } from '../../run/marketSize'
import type { HouseRuleId } from '../../run/variation/houseRules'
import type { RosterQuirkId } from '../../run/variation/rosterQuirks'

/** A league/team has been generated and the user's team picked, but the roster-quirk/house-rule/
 *  system draft hasn't been resolved yet -- not a real run until confirmDraft applies the choices.
 *  Held only in memory (not persisted): losing an in-progress draft to a refresh just means
 *  re-rolling, same cost as clicking "Start New Run" again. */
export interface PendingDraft {
  league: League
  teams: Team[]
  players: Player[]
  teamId: TeamId
  rosterQuirkOptions: RosterQuirkId[]
  houseRuleOptions: HouseRuleId[]
  systemOptions: SystemId[]
  /** Rolled (not drafted) alongside the league -- Section 8.1 is imposed, no player choice. */
  marketSize: MarketSizeId
}

export interface RunContextValue {
  bundle: RunBundle | null
  draft: PendingDraft | null
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
  confirmDraft: (rosterQuirk: RosterQuirkId, houseRule: HouseRuleId, system: SystemId) => Promise<void>
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
}

export const RunContext = createContext<RunContextValue | null>(null)
