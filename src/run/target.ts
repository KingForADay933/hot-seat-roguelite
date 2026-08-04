import type { StandingsRow, TeamId } from '../data/types'
import { MIN_TARGET_RANK_FRACTION, STARTING_TARGET_RANK_FRACTION, TARGET_RANK_FRACTION_STEP } from './constants'
import type { RunTarget } from './types'

/** The target for a given stretch: tightens by TARGET_RANK_FRACTION_STEP per successful stretch,
 *  floored at MIN_TARGET_RANK_FRACTION so it never demands an impossible finish. */
export function targetForStretch(stretchNumber: number): RunTarget {
  const rankFraction = Math.max(
    MIN_TARGET_RANK_FRACTION,
    STARTING_TARGET_RANK_FRACTION - (stretchNumber - 1) * TARGET_RANK_FRACTION_STEP,
  )
  return { rankFraction }
}

/** Standings must already be sorted best-to-worst (computeStandings' contract). Rank is 1-indexed;
 *  a team hits the target if its rank falls at or above the fraction's cutoff (ties broken by
 *  computeStandings' own winPct/pointDiff ordering, not re-litigated here). */
export function hasHitTarget(standings: StandingsRow[], teamId: TeamId, target: RunTarget): boolean {
  const rank = standings.findIndex((row) => row.teamId === teamId) + 1
  if (rank === 0) throw new Error(`Team ${teamId} not found in standings`)

  const targetRank = Math.ceil(standings.length * target.rankFraction)
  return rank <= targetRank
}
