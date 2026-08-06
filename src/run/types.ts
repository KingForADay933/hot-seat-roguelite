import type { TeamId } from '../data/types'
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
}
