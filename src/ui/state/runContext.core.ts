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
  beginDraft: () => Promise<void>
  confirmDraft: (rosterQuirk: RosterQuirkId, houseRule: HouseRuleId, system: SystemId) => Promise<void>
  /** Simulates the next chunk of the current season (or a fresh season's first chunk) -- Section
   *  1.5. The resulting bundle tells the caller which screen comes next (chunk checkpoint vs. the
   *  season-end results screen) via run.chunkInSeason. */
  simSeasonChunk: () => Promise<void>
  /** GM adjustment available at a chunk checkpoint (Section 1.5): overrides one player's target
   *  minutes (clamped 0-48) for the rest of the season. */
  setRotationMinutes: (playerId: PlayerId, minutes: number) => Promise<void>
  /** GM adjustment available at a chunk checkpoint: sets (or, given null, clears back to
   *  auto-computed) one player's training focus to a single attribute. */
  setTrainingFocus: (playerId: PlayerId, attribute: AttributeKey | null) => Promise<void>
  /** Opens this season's shop visit (Section 8.5) -- tier picked from lastSeasonTargetHit. */
  openShop: () => Promise<void>
  /** Buys one shop offer by id: spends budget, applies the camp, removes it from the offer list. */
  buyShopOffer: (offerId: string) => Promise<void>
  /** Re-rolls the current shop's offer list, consuming one of its rerollsRemaining. */
  rerollShop: () => Promise<void>
}

export const RunContext = createContext<RunContextValue | null>(null)
