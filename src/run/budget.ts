import type { StandingsRow } from '../data/types'
import { computeBudgetUpgradeBonus } from './coachingUpgrades/budgetBonus'
import { BUDGET_PER_WIN, STRETCH_CLEAR_BUDGET_BONUS } from './constants'
import { MARKET_SIZES } from './marketSize'
import type { RunState } from './types'

/**
 * Budget earned for one season: wins scaled by the market's budgetMultiplier, plus a flat
 * stretch-clear bonus (also scaled) when that season hit the target, plus whatever owned coaching
 * upgrades raise the payout by. Pure -- takes the run's pre-season state (for teamId/marketSize)
 * rather than the post-evaluateSeasonEnd one, so callers can compute this independently of the
 * target/fired state transition.
 *
 * The upgrade bonus sits *inside* the multiplier, exactly as the stretch-clear bonus does, so market
 * size keeps meaning what it means everywhere else. That reads as unfair to small markets until you
 * notice it self-corrects: small gets four seasons per stretch against big's two, so the market with
 * the weakest per-season bonus has the most seasons to collect it.
 */
export function computeSeasonBudgetEarnings(run: RunState, standings: StandingsRow[], targetHit: boolean): number {
  const winsThisSeason = standings.find((row) => row.teamId === run.teamId)?.wins ?? 0
  const multiplier = MARKET_SIZES[run.marketSize].budgetMultiplier

  const winEarnings = winsThisSeason * BUDGET_PER_WIN * multiplier
  const stretchBonus = targetHit ? STRETCH_CLEAR_BUDGET_BONUS * multiplier : 0
  const upgradeBonus = computeBudgetUpgradeBonus(run.coachingUpgrades) * multiplier

  return Math.round(winEarnings + stretchBonus + upgradeBonus)
}
