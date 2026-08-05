import { describe, expect, it } from 'vitest'
import type { StandingsRow } from '../data/types'
import { computeSeasonBudgetEarnings } from './budget'
import { BUDGET_PER_WIN, STRETCH_CLEAR_BUDGET_BONUS } from './constants'
import { MARKET_SIZES } from './marketSize'
import { createRun } from './runState'

function row(teamId: string, wins: number): StandingsRow {
  return { teamId, wins, losses: 0, winPct: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 }
}

describe('computeSeasonBudgetEarnings', () => {
  it('earns BUDGET_PER_WIN per win at mid market (1.0x), no bonus on a miss', () => {
    const run = createRun('us', 'stacked-guards', 'youth-movement', 'mid')
    const standings = [row('us', 20), row('them', 12)]
    expect(computeSeasonBudgetEarnings(run, standings, false)).toBe(20 * BUDGET_PER_WIN)
  })

  it('adds the stretch-clear bonus when the target was hit', () => {
    const run = createRun('us', 'stacked-guards', 'youth-movement', 'mid')
    const standings = [row('us', 20), row('them', 12)]
    expect(computeSeasonBudgetEarnings(run, standings, true)).toBe(20 * BUDGET_PER_WIN + STRETCH_CLEAR_BUDGET_BONUS)
  })

  it('scales both wins and the bonus by the market multiplier', () => {
    const bigRun = createRun('us', 'stacked-guards', 'youth-movement', 'big')
    const smallRun = createRun('us', 'stacked-guards', 'youth-movement', 'small')
    const standings = [row('us', 20), row('them', 12)]

    const bigEarnings = computeSeasonBudgetEarnings(bigRun, standings, true)
    const smallEarnings = computeSeasonBudgetEarnings(smallRun, standings, true)

    expect(bigEarnings).toBe(Math.round(20 * BUDGET_PER_WIN * MARKET_SIZES.big.budgetMultiplier + STRETCH_CLEAR_BUDGET_BONUS * MARKET_SIZES.big.budgetMultiplier))
    expect(bigEarnings).toBeGreaterThan(smallEarnings)
  })

  it('earns 0 for a team with no wins and no target hit', () => {
    const run = createRun('us', 'stacked-guards', 'youth-movement', 'mid')
    const standings = [row('us', 0), row('them', 32)]
    expect(computeSeasonBudgetEarnings(run, standings, false)).toBe(0)
  })

  it('treats a team missing from standings as 0 wins rather than throwing', () => {
    const run = createRun('us', 'stacked-guards', 'youth-movement', 'mid')
    const standings = [row('them', 32)]
    expect(computeSeasonBudgetEarnings(run, standings, false)).toBe(0)
  })
})
