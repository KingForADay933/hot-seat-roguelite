import type { Game, League, Player, StandingsRow, Team } from '../data/types'
import { generateCoachingInsights, type CoachingInsight } from '../engine/insights/generateCoachingInsights'
import { developSeason } from '../engine/season/developSeason'
import { generateSchedule } from '../engine/schedule/generateSchedule'
import { computeStandings } from '../engine/schedule/standings'
import type { Rng } from '../engine/rng'
import { simulateGame } from '../engine/simulateGame'
import { computeSeasonBudgetEarnings } from './budget'
import { RUN_SEASON_LENGTH, SEASON_CHUNK_COUNT } from './constants'
import { evaluateSeasonEnd } from './runState'
import { seasonChunkBoundaries } from './seasonChunks'
import { hasHitTarget } from './target'
import type { RunState } from './types'
import { rollWildcardEvent, type WildcardEventOutcome } from './variation/wildcardEvents'

export interface SeasonChunkResult {
  run: RunState
  league: League
  teams: Team[]
  players: Player[]
  /** The season's games so far -- unplayed slots still scheduled-only, played ones with their
   *  possession log already stripped (Section 1.5: Coaching Insights are pulled from it as it's
   *  simulated, then it's dropped -- nothing downstream needs possession-level detail). */
  games: Game[]
  /** This chunk's Coaching Insights for the user's own team only -- empty on a chunk with no
   *  notable moments, not necessarily an error. */
  chunkInsights: CoachingInsight[]
  /** True once the season's LAST chunk has just been played. standings/targetHit/budgetEarned are
   *  only meaningful when this is true; run.chunkInSeason has already rolled back to 0 (a fresh
   *  season boundary) by the time this returns -- see evaluateSeasonEnd. */
  seasonComplete: boolean
  standings: StandingsRow[]
  targetHit: boolean
  /** Non-null only on the chunk that rolled it (always chunk index 0, a season's first) -- null on
   *  every other chunk, including the season-ending one if that's not also the first. */
  wildcardEvent: WildcardEventOutcome | null
  budgetEarned: number
}

function stripPossessionLog(game: Game): Game {
  return { ...game, possessionLog: [] }
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
 * Simulates one chunk of the CURRENT (or, at chunkInSeason 0, a brand new) season: run.chunkInSeason
 * says which chunk is next. A fresh season additionally rolls that season's wildcard event and
 * generates its full schedule before simming chunk 0's slice of it; every other chunk continues
 * against the schedule already threaded through via the `games` parameter. Only the season's LAST
 * chunk also runs the once-per-season pipeline (standings, target evaluation, budget, player
 * development, league bookkeeping) -- see SeasonChunkResult.seasonComplete.
 */
export function simulateSeasonChunk(run: RunState, league: League, teams: Team[], players: Player[], games: Game[], rng: Rng): SeasonChunkResult {
  const isNewSeason = run.chunkInSeason === 0

  let seasonPlayers = players
  let seasonGames = games
  let wildcardEvent: WildcardEventOutcome | null = null

  if (isNewSeason) {
    const rolled = rollWildcardEvent(players, run.teamId, rng)
    seasonPlayers = rolled.players
    wildcardEvent = rolled.outcome
    seasonGames = generateSchedule(league.id, league.teamIds, RUN_SEASON_LENGTH, rng)
  }

  const { start, end } = seasonChunkBoundaries(seasonGames.length, SEASON_CHUNK_COUNT)[run.chunkInSeason]

  const playersById = new Map(seasonPlayers.map((p) => [p.id, p]))
  const teamsById = new Map(teams.map((t) => [t.id, t]))
  const possessionsPerGame = league.pacePresets.possessionsPerGame

  const chunkInsights: CoachingInsight[] = []
  const updatedGames = [...seasonGames]

  for (let i = start; i < end; i++) {
    const scheduled = seasonGames[i]
    const homeTeam = teamsById.get(scheduled.homeTeamId)
    const awayTeam = teamsById.get(scheduled.awayTeamId)
    if (!homeTeam || !awayTeam) throw new Error(`Game ${scheduled.id} references a team not in this league`)

    const played = simulateGame(scheduled, homeTeam, awayTeam, playersById, possessionsPerGame, rng)

    if (played.homeTeamId === run.teamId || played.awayTeamId === run.teamId) {
      const gameInsights = generateCoachingInsights(played.possessionLog, homeTeam, awayTeam, playersById, possessionsPerGame)
      chunkInsights.push(...gameInsights.filter((insight) => insight.teamId === run.teamId))
    }

    updatedGames[i] = stripPossessionLog(played)
  }

  const dedupedChunkInsights = dedupeInsights(chunkInsights)

  const isLastChunk = run.chunkInSeason + 1 === SEASON_CHUNK_COUNT
  if (!isLastChunk) {
    return {
      run: { ...run, chunkInSeason: run.chunkInSeason + 1 },
      league,
      teams,
      players: seasonPlayers,
      games: updatedGames,
      chunkInsights: dedupedChunkInsights,
      seasonComplete: false,
      standings: [],
      targetHit: false,
      wildcardEvent,
      budgetEarned: 0,
    }
  }

  const standings = computeStandings(teams, updatedGames)
  const targetHit = hasHitTarget(standings, run.teamId, run.target)
  const budgetEarned = computeSeasonBudgetEarnings(run, standings, targetHit)
  const nextRun: RunState = { ...evaluateSeasonEnd(run, standings), budget: run.budget + budgetEarned }
  const developedPlayers = developSeason(seasonPlayers, teams, updatedGames)

  const updatedLeague: League = {
    ...league,
    seasonNumber: league.seasonNumber + 1,
    seasonHistory: [...league.seasonHistory, { seasonNumber: league.seasonNumber, standings }],
    scheduleGameIds: updatedGames.map((g) => g.id),
    currentDate: new Date().toISOString(),
  }

  return {
    run: nextRun,
    league: updatedLeague,
    teams,
    players: developedPlayers,
    games: updatedGames,
    chunkInsights: dedupedChunkInsights,
    seasonComplete: true,
    standings,
    targetHit,
    wildcardEvent,
    budgetEarned,
  }
}
