import type { GameId, LeagueId, TeamId } from './common'
import type { SeasonSummary } from './season'

export interface LeagueRules {
  /** Games per team. */
  seasonLength: number
  /** Out of scope for v0.1 — regular-season standings only. */
  playoffFormat: null
}

export interface LeaguePaceScoringPresets {
  /** Feeds engine/simulateGame.ts's possession loop bound. */
  possessionsPerGame: number
}

export interface League {
  id: LeagueId
  name: string
  /** MVP: no conferences/divisions. Literal union leaves room for future structures. */
  structure: 'single-conference'
  teamIds: TeamId[]
  /** Ordered; actual Game objects live in persistence, keyed by id. */
  scheduleGameIds: GameId[]
  rules: LeagueRules
  pacePresets: LeaguePaceScoringPresets
  /** ISO date string tracking sim progress through the schedule. */
  currentDate: string
  /** The team the user manages in this franchise, chosen once right after generation.
   *  Null/missing (including on leagues saved before this field existed) routes to team select. */
  userControlledTeamId: TeamId | null
  /** 1-indexed; bumped by one each rollover (see engine/season and LeagueContext.rolloverSeason). */
  seasonNumber: number
  /** Completed seasons' final standings, oldest first. That season's games/possession logs are
   *  discarded at rollover -- this summary is all that's retained (Section 6's rolling window). */
  seasonHistory: SeasonSummary[]
}
