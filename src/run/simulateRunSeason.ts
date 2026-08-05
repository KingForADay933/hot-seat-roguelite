import type { Game, League, Player, StandingsRow, Team } from '../data/types'
import { developSeason } from '../engine/season/developSeason'
import { generateSchedule } from '../engine/schedule/generateSchedule'
import { computeStandings } from '../engine/schedule/standings'
import type { Rng } from '../engine/rng'
import { simulateGame } from '../engine/simulateGame'
import { computeSeasonBudgetEarnings } from './budget'
import { RUN_SEASON_LENGTH } from './constants'
import { evaluateSeasonEnd } from './runState'
import { hasHitTarget } from './target'
import type { RunState } from './types'
import { rollWildcardEvent, type WildcardEventOutcome } from './variation/wildcardEvents'

export interface RunSeasonResult {
  run: RunState
  league: League
  teams: Team[]
  players: Player[]
  games: Game[]
  standings: StandingsRow[]
  targetHit: boolean
  wildcardEvent: WildcardEventOutcome | null
  /** Budget earned this season specifically (not the cumulative total, which lives on run.budget). */
  budgetEarned: number
}

/**
 * Plays one full season headlessly -- wildcard roll, schedule, every game, standings, player
 * development -- and folds the result into the run's target/fired state machine. The one function
 * a caller (a UI screen, a leaderboard sim, a test) needs to advance a run by a season; no UI
 * required to play a run start to finish.
 */
export function simulateRunSeason(run: RunState, league: League, teams: Team[], players: Player[], rng: Rng): RunSeasonResult {
  // Rolled before the season plays, not after, so a breakout/slump actually affects this season's
  // games rather than landing as after-the-fact flavor text.
  const { players: playersAfterWildcard, outcome: wildcardEvent } = rollWildcardEvent(players, run.teamId, rng)

  const scheduledGames = generateSchedule(league.id, league.teamIds, RUN_SEASON_LENGTH, rng)
  const playersById = new Map(playersAfterWildcard.map((p) => [p.id, p]))
  const teamsById = new Map(teams.map((t) => [t.id, t]))

  const games = scheduledGames.map((game) => {
    const homeTeam = teamsById.get(game.homeTeamId)
    const awayTeam = teamsById.get(game.awayTeamId)
    if (!homeTeam || !awayTeam) throw new Error(`Game ${game.id} references a team not in this league`)
    return simulateGame(game, homeTeam, awayTeam, playersById, league.pacePresets.possessionsPerGame, rng)
  })

  const standings = computeStandings(teams, games)
  const targetHit = hasHitTarget(standings, run.teamId, run.target)
  const budgetEarned = computeSeasonBudgetEarnings(run, standings, targetHit)
  const nextRun: RunState = { ...evaluateSeasonEnd(run, standings), budget: run.budget + budgetEarned }
  const developedPlayers = developSeason(playersAfterWildcard, teams, games)

  const updatedLeague: League = {
    ...league,
    seasonNumber: league.seasonNumber + 1,
    seasonHistory: [...league.seasonHistory, { seasonNumber: league.seasonNumber, standings }],
    scheduleGameIds: games.map((g) => g.id),
    currentDate: new Date().toISOString(),
  }

  return { run: nextRun, league: updatedLeague, teams, players: developedPlayers, games, standings, targetHit, wildcardEvent, budgetEarned }
}
