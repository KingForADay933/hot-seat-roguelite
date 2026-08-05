import { createContext } from 'react'
import type { League, Player, Team, TeamId } from '../../data/types'
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
  simSeason: () => Promise<void>
}

export const RunContext = createContext<RunContextValue | null>(null)
