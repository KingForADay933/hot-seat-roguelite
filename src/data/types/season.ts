import type { TeamId } from './common'

export interface StandingsRow {
  teamId: TeamId
  wins: number
  losses: number
  winPct: number
  pointsFor: number
  pointsAgainst: number
  pointDiff: number
}

/** A completed season's final standings, retained after its games/possession logs are discarded
 *  at rollover (see Section 6's rolling-window policy). */
export interface SeasonSummary {
  seasonNumber: number
  standings: StandingsRow[]
}
