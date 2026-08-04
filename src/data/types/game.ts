import type { GameId, LeagueId, PlayerId, TeamId } from './common'

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
  offenseTeamId: TeamId
  playCallUsed: PlayCallType
  primaryPlayerId: PlayerId
  secondaryPlayerIds: PlayerId[]
  outcome: PossessionOutcome
  pointsScored: 0 | 2 | 3
  /** Needed to derive FGA/3PA splits on misses, where pointsScored alone can't distinguish a 2 from a 3. */
  isThreePointAttempt: boolean
  /** Union of offense + defense players credited, for box-score attribution. */
  playersInvolved: PlayerId[]
  /** The team's full on-court five (both teams play every possession, offense and defense) at the
   *  moment this possession was resolved. Always length 5. Makes the possession log fully
   *  self-sufficient for box-score derivation (rebounds, minutes) even as substitutions happen. */
  homeOnCourtIds: PlayerId[]
  awayOnCourtIds: PlayerId[]
}

export interface PlayerBoxScoreLine {
  playerId: PlayerId
  points: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  assists: number
  rebounds: number
  turnovers: number
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
