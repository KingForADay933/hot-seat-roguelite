import { describe, expect, it } from 'vitest'
import { CONSUMABLE_COST, ENERGY_DRINK_SPONSORSHIP_BUDGET_BONUS } from '../constants'
import { createRun } from '../runState'
import type { RunState } from '../types'
import { consumableActivationBlockedReason, isBudgetPayoutConsumable } from './activation'

function run(overrides: Partial<RunState> = {}): RunState {
  return { ...createRun('team-1', 'low-ceiling', 'minutes-cap', 'mid'), ...overrides }
}

describe('isBudgetPayoutConsumable', () => {
  it('names the sponsorship and nothing else', () => {
    // The distinction the whole rule turns on: this is the only card whose reward is denominated in
    // the same currency as its price, so it is the only one that can pay for its own repurchase.
    expect(isBudgetPayoutConsumable('energy-drink-sponsorship')).toBe(true)
    for (const id of ['sports-psych-session', 'load-management', 'film-room-marathon', 'extra-shootaround', 'defensive-bootcamp', 'lucky-jersey'] as const) {
      expect(isBudgetPayoutConsumable(id)).toBe(false)
    }
  })
})

describe('consumableActivationBlockedReason', () => {
  it('lets the sponsorship through the first time in a season', () => {
    expect(consumableActivationBlockedReason('energy-drink-sponsorship', run())).toBeNull()
  })

  it('blocks a second one in the same season', () => {
    const cashed = run({ activeConsumablesThisSeason: ['energy-drink-sponsorship'] })
    expect(consumableActivationBlockedReason('energy-drink-sponsorship', cashed)).toContain('once')
  })

  it('never blocks a card that pays out in ratings, however many are already active', () => {
    // Stacking effect cards is deliberate -- chunkSimContext applies each active one in turn, and
    // My Team shows "x2". Only the money card is capped.
    const stacked = run({ activeConsumablesThisSeason: ['extra-shootaround', 'extra-shootaround'] })
    expect(consumableActivationBlockedReason('extra-shootaround', stacked)).toBeNull()
  })

  it('frees the sponsorship again once the season rolls over', () => {
    // createRun's season rollover clears activeConsumablesThisSeason (run/runState.ts), which is why
    // the rule needs no state of its own.
    const nextSeason = run({ activeConsumablesThisSeason: [] })
    expect(consumableActivationBlockedReason('energy-drink-sponsorship', nextSeason)).toBeNull()
  })
})

describe('the loop this rule exists to close', () => {
  it('would be free money without it, and terminates with it', () => {
    // The exploit, as arithmetic: the payout is bigger than the price, and both buying and cashing
    // were repeatable inside one shop visit. Pinning the numbers so a future tweak to either
    // constant cannot quietly reopen it.
    expect(ENERGY_DRINK_SPONSORSHIP_BUDGET_BONUS).toBeGreaterThan(CONSUMABLE_COST)

    let budget = 500
    let state = run()
    let cycles = 0
    while (budget >= CONSUMABLE_COST && cycles < 100) {
      if (consumableActivationBlockedReason('energy-drink-sponsorship', state)) break
      budget -= CONSUMABLE_COST // buy
      budget += ENERGY_DRINK_SPONSORSHIP_BUDGET_BONUS // cash
      state = { ...state, activeConsumablesThisSeason: [...state.activeConsumablesThisSeason, 'energy-drink-sponsorship'] }
      cycles += 1
    }

    // Exactly one turn of the crank, for exactly the card's stated value.
    expect(cycles).toBe(1)
    expect(budget).toBe(500 - CONSUMABLE_COST + ENERGY_DRINK_SPONSORSHIP_BUDGET_BONUS)
  })
})
