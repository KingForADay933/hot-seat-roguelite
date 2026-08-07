import type { Game, League, Player, StandingsRow, Team } from '../data/types'
import type { CoachingInsight } from '../engine/insights/generateCoachingInsights'
import { computeStandings } from '../engine/schedule/standings'
import { developSeason } from '../engine/season/developSeason'
import { computeSeasonBudgetEarnings } from './budget'
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

/** A chunk spans several games, and the same routine substitution/matchup pattern often recurs
 *  game after game -- collapsing exact-text repeats keeps the checkpoint screen readable (the
 *  point is surfacing something worth reacting to, not restating the same line 8 times). */
function dedupeInsights(insights: CoachingInsight[]): CoachingInsight[] {
  const seen = new Set<string>()
  return insights.filter((insight) => {
    if (seen.has(insight.text)) return false
    seen.add(insight.text)
    return true
  })
}

/**
 * Closes out a chunk once every one of its games has been resolved: advances the chunk counter, or,
 * on the season's last chunk, runs the once-per-season pipeline (standings, target evaluation,
 * budget, player development, league bookkeeping).
 *
 * Split out of simulateSeasonChunk so the checkpoint can be reached two ways -- simming a whole
 * chunk in one call, or the GM resolving its games one at a time off the stretch screen -- without
 * either path re-implementing the season-end bookkeeping. `insights` is whatever the chunk's games
 * produced, in resolution order; deduping happens here rather than per game because a repeat only
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
  const chunkInsights = dedupeInsights(insights)
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
