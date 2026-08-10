import { describe, expect, it } from 'vitest'
import type { StandingsRow } from '../data/types'
import { computeSeasonBudgetEarnings } from './budget'
import { BUDGET_PER_WIN, COACHING_UPGRADE_COST, FAN_CULTURE_BUY_IN_SEASON_BONUS, STRETCH_CLEAR_BUDGET_BONUS } from './constants'
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

describe('Fan Culture Buy-In', () => {
  const standings = [row('us', 20), row('them', 12)]

  it('adds nothing until it is owned', () => {
    const run = createRun('us', 'stacked-guards', 'youth-movement', 'mid')
    expect(run.coachingUpgrades).toEqual([])
    expect(computeSeasonBudgetEarnings(run, standings, false)).toBe(20 * BUDGET_PER_WIN)
  })

  it('raises every season by exactly the constant at mid market', () => {
    const run = { ...createRun('us', 'stacked-guards', 'youth-movement', 'mid'), coachingUpgrades: ['fan-culture-buy-in' as const] }
    expect(computeSeasonBudgetEarnings(run, standings, false)).toBe(20 * BUDGET_PER_WIN + FAN_CULTURE_BUY_IN_SEASON_BONUS)
  })

  it('is scaled by the market multiplier, like every other flat term in the formula', () => {
    for (const marketSize of ['big', 'mid', 'small'] as const) {
      const without = createRun('us', 'stacked-guards', 'youth-movement', marketSize)
      const owned = { ...without, coachingUpgrades: ['fan-culture-buy-in' as const] }
      const delta = computeSeasonBudgetEarnings(owned, standings, false) - computeSeasonBudgetEarnings(without, standings, false)
      expect(delta).toBe(Math.round(FAN_CULTURE_BUY_IN_SEASON_BONUS * MARKET_SIZES[marketSize].budgetMultiplier))
    }
  })

  it('stacks with the stretch-clear bonus rather than replacing it', () => {
    const run = { ...createRun('us', 'stacked-guards', 'youth-movement', 'mid'), coachingUpgrades: ['fan-culture-buy-in' as const] }
    expect(computeSeasonBudgetEarnings(run, standings, true)).toBe(
      20 * BUDGET_PER_WIN + STRETCH_CLEAR_BUDGET_BONUS + FAN_CULTURE_BUY_IN_SEASON_BONUS,
    )
  })

  it('pays out on a losing season too, which is the point of it being flat', () => {
    // A percentage would pay least exactly here -- the season where the budget matters most and the
    // GM is closest to being fired.
    const run = { ...createRun('us', 'stacked-guards', 'youth-movement', 'mid'), coachingUpgrades: ['fan-culture-buy-in' as const] }
    const badSeason = [row('us', 8), row('them', 24)]
    expect(computeSeasonBudgetEarnings(run, badSeason, false)).toBe(8 * BUDGET_PER_WIN + FAN_CULTURE_BUY_IN_SEASON_BONUS)
  })

  it('takes COACHING_UPGRADE_COST / the bonus seasons to pay for itself', () => {
    // The number the constant was chosen against. Pinned so moving either constant has to be a
    // deliberate act rather than a silent change to how long the card takes to be worth buying.
    expect(Math.ceil(COACHING_UPGRADE_COST / FAN_CULTURE_BUY_IN_SEASON_BONUS)).toBe(3)
  })
})
