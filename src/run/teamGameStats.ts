import type { Game, PlayerBoxScoreLine, TeamId } from '../data/types'

/**
 * One team's game reduced to team totals, for and against.
 *
 * Derived from `game.result.boxScore`, which survives every game permanently -- unlike the
 * possession log, which resolveGame strips as soon as a game resolves. That is the whole reason
 * performance insights can be recomputed on demand rather than captured at the moment a game ends:
 * the numbers they read are still there at the end of the season, in `bundle.games`.
 *
 * Both sides are recorded because half the interesting questions are defensive. What the opponent
 * shot against you is not derivable from your own lines, and it is the single most direct measure of
 * whether a defensive scheme is working.
 */
export interface TeamGameStats {
  gameId: string
  /** True when this team won -- the same >= comparison computeStandings uses. */
  won: boolean
  points: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  assists: number
  rebounds: number
  steals: number
  blocks: number
  turnovers: number
  opponentPoints: number
  opponentFieldGoalsMade: number
  opponentFieldGoalsAttempted: number
  opponentThreePointersMade: number
  opponentThreePointersAttempted: number
  opponentRebounds: number
  /** Turnovers the opponent committed -- forced turnovers from this team's point of view. Not the
   *  same as this team's steals, since only a share of turnovers have a defender to credit. */
  opponentTurnovers: number
}

function sum(lines: PlayerBoxScoreLine[], pick: (line: PlayerBoxScoreLine) => number): number {
  return lines.reduce((total, line) => total + pick(line), 0)
}

/**
 * Null for a game this team didn't play, or one that hasn't been played yet -- both are ordinary
 * conditions for a caller scanning a whole season's schedule, not errors.
 */
export function teamGameStats(game: Game, teamId: TeamId): TeamGameStats | null {
  if (!game.isPlayed || !game.result) return null
  const isHome = game.homeTeamId === teamId
  if (!isHome && game.awayTeamId !== teamId) return null

  const own = isHome ? game.result.boxScore.home : game.result.boxScore.away
  const opponent = isHome ? game.result.boxScore.away : game.result.boxScore.home
  const points = isHome ? game.result.homeScore : game.result.awayScore
  const opponentPoints = isHome ? game.result.awayScore : game.result.homeScore

  return {
    gameId: game.id,
    won: points >= opponentPoints,
    points,
    fieldGoalsMade: sum(own, (l) => l.fieldGoalsMade),
    fieldGoalsAttempted: sum(own, (l) => l.fieldGoalsAttempted),
    threePointersMade: sum(own, (l) => l.threePointersMade),
    threePointersAttempted: sum(own, (l) => l.threePointersAttempted),
    freeThrowsMade: sum(own, (l) => l.freeThrowsMade),
    freeThrowsAttempted: sum(own, (l) => l.freeThrowsAttempted),
    assists: sum(own, (l) => l.assists),
    rebounds: sum(own, (l) => l.rebounds),
    steals: sum(own, (l) => l.steals),
    blocks: sum(own, (l) => l.blocks),
    turnovers: sum(own, (l) => l.turnovers),
    opponentPoints,
    opponentFieldGoalsMade: sum(opponent, (l) => l.fieldGoalsMade),
    opponentFieldGoalsAttempted: sum(opponent, (l) => l.fieldGoalsAttempted),
    opponentThreePointersMade: sum(opponent, (l) => l.threePointersMade),
    opponentThreePointersAttempted: sum(opponent, (l) => l.threePointersAttempted),
    opponentRebounds: sum(opponent, (l) => l.rebounds),
    opponentTurnovers: sum(opponent, (l) => l.turnovers),
  }
}

/** Every played game this team appeared in, in schedule order. */
export function teamStatsForGames(games: Game[], teamId: TeamId): TeamGameStats[] {
  return games.map((game) => teamGameStats(game, teamId)).filter((stats): stats is TeamGameStats => stats !== null)
}
