import type { TeamId } from '../data/types'

export interface RunTarget {
  /** Fraction of the league a team must rank within (best = 0) to hit the target, e.g. 0.5 = top half. */
  rankFraction: number
}

export type RunStatus = 'active' | 'fired'

export interface RunState {
  runId: string
  /** The user's team for the whole run -- doesn't change stretch to stretch. */
  teamId: TeamId
  /** 1-indexed; bumps every time the target is hit and a harder stretch begins. */
  stretchNumber: number
  /** 1..SEASONS_PER_STRETCH; resets to 1 whenever a new stretch begins. */
  seasonInStretch: number
  /** Total seasons played across the whole run, successful or not -- the "how long did I survive" number. */
  seasonsPlayed: number
  target: RunTarget
  status: RunStatus
}
