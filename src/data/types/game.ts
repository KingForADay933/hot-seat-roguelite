import type { GameId, LeagueId, PlayerId, Position, TeamId } from './common'

/**
 * One player on the floor, and the slot they were filling.
 *
 * The slot is recorded rather than re-derived from the player's own listed position because those
 * two can differ: a GM may put someone out of position, and the slot is what the simulation paired
 * matchups on. Anything replaying a possession -- Coaching Insights' fatigue reconstruction, a live
 * broadcast panel -- needs the assignment that actually happened, not a guess at it.
 */
export interface OnCourtRecord {
  playerId: PlayerId
  slot: Position
}

export type PossessionOutcome = 'make' | 'miss' | 'turnover' | 'foul'

export type PlayCallType =
  | 'pick-and-roll'
  | 'isolation'
  | 'post-up'
  | 'spot-up'
  | 'cutting'
  | 'transition'

export interface PossessionLogEntry {
  possessionNumber: number
  /** 1-4 for regulation quarters, 5+ for successive overtimes. A real period, not a label derived
   *  by slicing the possession count into four -- the loop runs one period at a time now. */
  period: number
  /** Clock left in the period once this possession finished, in seconds. 0 means it ran the period
   *  out. Together with `durationSeconds` this makes the log a complete record of game time. */
  clockSecondsRemaining: number
  /** Seconds this possession took off the clock, already truncated to whatever was left. The sole
   *  input to minutes played -- box scores sum it per on-court player rather than scaling a
   *  possession count. */
  durationSeconds: number
  offenseTeamId: TeamId
  playCallUsed: PlayCallType
  primaryPlayerId: PlayerId
  secondaryPlayerIds: PlayerId[]
  outcome: PossessionOutcome
  /** Points the offense actually scored. A field goal is 2 or 3; a shooting foul is 0-3 depending
   *  on how many of the awarded free throws dropped, so this is not a fixed union. */
  pointsScored: number
  /** Needed to derive FGA/3PA splits on misses, where pointsScored alone can't distinguish a 2 from
   *  a 3 -- and on fouls, where it sets the number of free throws awarded. */
  isThreePointAttempt: boolean
  /** Free throws from a shooting foul. Both 0 on every other outcome -- there's no non-shooting
   *  foul or bonus/penalty model, so free throws only ever arrive via outcome === 'foul'. */
  freeThrowsMade: number
  freeThrowsAttempted: number
  /** True when the offense recovered its own miss and kept the ball, so the next entry is this same
   *  team's second-chance shot. Only ever true on outcome === 'miss'. Decided by the simulation and
   *  recorded here rather than re-rolled downstream, so the box score credits the board to the side
   *  that actually kept possession. */
  offensiveRebound: boolean
  /** True when this attempt came off an offensive rebound -- a putback continuing the previous
   *  trip, not a fresh possession. Distinguishes plays from possessions when reading the log. */
  isSecondChance: boolean
  /** Union of offense + defense players credited, for box-score attribution. */
  playersInvolved: PlayerId[]
  /** The team's full on-court five (both teams play every possession, offense and defense) at the
   *  moment this possession was resolved, each with the slot they were filling. Always length 5.
   *  Makes the possession log fully self-sufficient for box-score derivation (rebounds, minutes) and
   *  for replaying who was matched up on whom, even as substitutions happen. */
  homeOnCourt: OnCourtRecord[]
  awayOnCourt: OnCourtRecord[]
}

export interface PlayerBoxScoreLine {
  playerId: PlayerId
  points: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  assists: number
  rebounds: number
  turnovers: number
  /** Shooting fouls *drawn* by this player, not personal fouls committed -- there's no defensive
   *  foul attribution model, so the whistle is credited to the offensive player who earned the trip
   *  to the line. Pairs with freeThrowsAttempted above. */
  fouls: number
  minutesPlayed: number
}

export interface GameResult {
  homeScore: number
  awayScore: number
  boxScore: {
    home: PlayerBoxScoreLine[]
    away: PlayerBoxScoreLine[]
  }
  /** 0 for a game decided in regulation. simulateGame guarantees a decisive winner, so ties never
   *  reach this field -- extra periods keep running until one does (see engine/simulateGame.ts). */
  overtimePeriods: number
}

export interface Game {
  id: GameId
  leagueId: LeagueId
  homeTeamId: TeamId
  awayTeamId: TeamId
  /** ISO date. */
  date: string
  isPlayed: boolean
  result: GameResult | null
  /** Source of truth — box score is derived from this. */
  possessionLog: PossessionLogEntry[]
  /** Contract-only — no saved-games UI in MVP. */
  isSaved: boolean
}
