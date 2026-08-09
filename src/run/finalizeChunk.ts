import { DEFENSIVE_SCHEMES } from '../data/presets'
import type { Game, League, Player, StandingsRow, Team } from '../data/types'
import type { CoachingInsight } from '../engine/insights/generateCoachingInsights'
import { computeStandings } from '../engine/schedule/standings'
import { developSeason } from '../engine/season/developSeason'
import { computeSeasonBudgetEarnings } from './budget'
import { summarizeChunkInsights } from './chunkInsightSummary'
import { SEASON_CHUNK_COUNT } from './constants'
import { evaluateSeasonEnd } from './runState'
import { hasHitTarget } from './target'
import type { RunState } from './types'

export interface ChunkOutcome {
  run: RunState
  league: League
  teams: Team[]
  players: Player[]
  /** The season's games so far -- unplayed slots still scheduled-only, played ones with their
   *  possession log already stripped by resolveGame. */
  games: Game[]
  /** This chunk's Coaching Insights for the user's own team only, deduped -- empty on a chunk with
   *  no notable moments, not necessarily an error. */
  chunkInsights: CoachingInsight[]
  /** True once the season's LAST chunk has just been played. standings/targetHit/budgetEarned are
   *  only meaningful when this is true; run.chunkInSeason has already rolled back to 0 (a fresh
   *  season boundary) by the time this returns -- see evaluateSeasonEnd. */
  seasonComplete: boolean
  standings: StandingsRow[]
  targetHit: boolean
  budgetEarned: number
}

/**
 * Closes out a chunk once every one of its games has been resolved: advances the chunk counter, or,
 * on the season's last chunk, runs the once-per-season pipeline (standings, target evaluation,
 * budget, player development, league bookkeeping).
 *
 * Split out of simulateSeasonChunk so the checkpoint can be reached two ways -- simming a whole
 * chunk in one call, or the GM resolving its games one at a time off the stretch screen -- without
 * either path re-implementing the season-end bookkeeping. `insights` is whatever the chunk's games
 * produced, in resolution order; collapsing happens here rather than per game because a repeat only
 * becomes visible once the whole chunk's worth is in hand.
 */
export function finalizeChunk(
  run: RunState,
  league: League,
  teams: Team[],
  players: Player[],
  games: Game[],
  insights: CoachingInsight[],
): ChunkOutcome {
  // Named so the collapsed weak-link line can say which scheme is being exploited -- it is the
  // thing the GM would change in response, and the single-game text it replaces said so inline.
  const userTeam = teams.find((t) => t.id === run.teamId)
  const chunkInsights = summarizeChunkInsights(insights, userTeam && DEFENSIVE_SCHEMES[userTeam.defensiveStrategyId]?.name)
  const isLastChunk = run.chunkInSeason + 1 === SEASON_CHUNK_COUNT

  if (!isLastChunk) {
    return {
      run: { ...run, chunkInSeason: run.chunkInSeason + 1 },
      league,
      teams,
      players,
      games,
      chunkInsights,
      seasonComplete: false,
      standings: [],
      targetHit: false,
      budgetEarned: 0,
    }
  }

  const standings = computeStandings(teams, games)
  const targetHit = hasHitTarget(standings, run.teamId, run.target)
  const budgetEarned = computeSeasonBudgetEarnings(run, standings, targetHit)
  const nextRun: RunState = { ...evaluateSeasonEnd(run, standings), budget: run.budget + budgetEarned }
  const developedPlayers = developSeason(players, teams, games)

  const updatedLeague: League = {
    ...league,
    seasonNumber: league.seasonNumber + 1,
    seasonHistory: [...league.seasonHistory, { seasonNumber: league.seasonNumber, standings }],
    scheduleGameIds: games.map((g) => g.id),
    currentDate: new Date().toISOString(),
  }

  return {
    run: nextRun,
    league: updatedLeague,
    teams,
    players: developedPlayers,
    games,
    chunkInsights,
    seasonComplete: true,
    standings,
    targetHit,
    budgetEarned,
  }
}
