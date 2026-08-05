import type { StandingsRow } from '../data/types'
import { BUDGET_PER_WIN, STRETCH_CLEAR_BUDGET_BONUS } from './constants'
import { MARKET_SIZES } from './marketSize'
import type { RunState } from './types'

/**
 * Budget earned for one season: wins scaled by the market's budgetMultiplier, plus a flat
 * stretch-clear bonus (also scaled) when that season hit the target. Pure -- takes the run's
 * pre-season state (for teamId/marketSize) rather than the post-evaluateSeasonEnd one, so callers
 * can compute this independently of the target/fired state transition.
 */
export function computeSeasonBudgetEarnings(run: RunState, standings: StandingsRow[], targetHit: boolean): number {
  const winsThisSeason = standings.find((row) => row.teamId === run.teamId)?.wins ?? 0
  const multiplier = MARKET_SIZES[run.marketSize].budgetMultiplier

  const winEarnings = winsThisSeason * BUDGET_PER_WIN * multiplier
  const stretchBonus = targetHit ? STRETCH_CLEAR_BUDGET_BONUS * multiplier : 0

  return Math.round(winEarnings + stretchBonus)
}
