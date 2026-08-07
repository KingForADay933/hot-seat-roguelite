import type { TeamId } from '../data/types'
import type { CoachingUpgradeId } from './coachingUpgrades/catalog'
import type { ConsumableId } from './consumables/catalog'
import type { MarketSizeId } from './marketSize'
import type { HouseRuleId } from './variation/houseRules'
import type { RosterQuirkId } from './variation/rosterQuirks'

export interface RunTarget {
  /** Fraction of the league a team must rank within (best = 0) to hit the target, e.g. 0.5 = top half. */
  rankFraction: number
}

export type RunStatus = 'active' | 'fired'

export interface RunState {
  runId: string
  /** The user's team for the whole run -- doesn't change stretch to stretch. */
  teamId: TeamId
  /** 1-indexed; bumps every time the target is hit and a harder stretch begins. */
  stretchNumber: number
  /** 1..SEASONS_PER_STRETCH; resets to 1 whenever a new stretch begins. */
  seasonInStretch: number
  /** Total seasons played across the whole run, successful or not -- the "how long did I survive" number. */
  seasonsPlayed: number
  target: RunTarget
  status: RunStatus
  /** Randomized once at run creation and fixed for the whole run (Section 3's variation axes). */
  rosterQuirk: RosterQuirkId
  houseRule: HouseRuleId
  /** Imposed (not drafted) at run creation; fixes seasonsPerStretch below for the whole run. */
  marketSize: MarketSizeId
  /** Derived from marketSize at creation and copied here so evaluateSeasonEnd doesn't need to look
   *  it up -- was a global constant before Section 8.1 made it market-dependent. */
  seasonsPerStretch: number
  /** Section 8.4's currency. Earned each season, spent in the shop (Section 8.4/8.5). */
  budget: number
  /** Chunks of the CURRENT season completed so far (Section 9), 0..SEASON_CHUNK_COUNT. Reset to
   *  0 whenever a season fully concludes (see evaluateSeasonEnd) -- 0 doubles as "no chunk of the
   *  next season has been simulated yet," the signal simulateSeasonChunk uses to know it needs to
   *  generate a fresh schedule and roll that season's wildcard event before simming chunk 1. */
  chunkInSeason: number
  /** Section 8.6's coaching-upgrade cards owned so far this run -- permanent once bought, never
   *  reset mid-run. Each id can only appear once (run/coachingUpgrades/catalog.ts's pool is
   *  exclusion-filtered by this list when rolling shop offers). */
  coachingUpgrades: CoachingUpgradeId[]
  /** Section 8.7's consumables currently held, unspent -- capped at CONSUMABLE_INVENTORY_CAPACITY.
   *  Unlike coachingUpgrades, duplicates are allowed (an item stash, not a one-per-run pool). */
  consumableInventory: ConsumableId[]
  /** Consumables burned for the season currently in progress (or about to start) -- read by every
   *  chunk of that season (simulateSeasonChunk.ts) to build transient, boosted roster/team copies
   *  for that season's games only. Cleared back to [] by evaluateSeasonEnd once the season
   *  completes, so nothing leaks into a season where the GM activated nothing new. */
  activeConsumablesThisSeason: ConsumableId[]
}
