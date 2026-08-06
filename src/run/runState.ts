import { createId } from '../data/ids'
import type { StandingsRow, TeamId } from '../data/types'
import { MARKET_SIZES, type MarketSizeId } from './marketSize'
import { hasHitTarget, targetForStretch } from './target'
import type { RunState } from './types'
import type { HouseRuleId } from './variation/houseRules'
import type { RosterQuirkId } from './variation/rosterQuirks'

export function createRun(teamId: TeamId, rosterQuirk: RosterQuirkId, houseRule: HouseRuleId, marketSize: MarketSizeId): RunState {
  return {
    runId: createId('run'),
    teamId,
    stretchNumber: 1,
    seasonInStretch: 1,
    seasonsPlayed: 0,
    target: targetForStretch(1),
    status: 'active',
    rosterQuirk,
    houseRule,
    marketSize,
    seasonsPerStretch: MARKET_SIZES[marketSize].seasonsPerStretch,
    budget: 0,
    chunkInSeason: 0,
    coachingUpgrades: [],
  }
}

/**
 * Pure state transition for the end of a season: hitting the target ends the stretch early and
 * escalates (new stretch, harder target, season count resets); missing it burns one of the
 * stretch's run.seasonsPerStretch chances (market-size-dependent, Section 8.1); running out of
 * chances without ever hitting it fires the GM. Only called once a season's last chunk has played
 * (Section 9) -- every branch resets chunkInSeason to 0 since the (next) season hasn't started yet.
 */
export function evaluateSeasonEnd(run: RunState, standings: StandingsRow[]): RunState {
  if (run.status === 'fired') return run

  const seasonsPlayed = run.seasonsPlayed + 1
  const targetHit = hasHitTarget(standings, run.teamId, run.target)

  if (targetHit) {
    const stretchNumber = run.stretchNumber + 1
    return {
      ...run,
      seasonsPlayed,
      stretchNumber,
      seasonInStretch: 1,
      target: targetForStretch(stretchNumber),
      status: 'active',
      chunkInSeason: 0,
    }
  }

  if (run.seasonInStretch < run.seasonsPerStretch) {
    return { ...run, seasonsPlayed, seasonInStretch: run.seasonInStretch + 1, chunkInSeason: 0 }
  }

  return { ...run, seasonsPlayed, status: 'fired', chunkInSeason: 0 }
}
