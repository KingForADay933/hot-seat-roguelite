import { describe, expect, it } from 'vitest'
import type { StandingsRow } from '../data/types'
import { SEASONS_PER_STRETCH, STARTING_TARGET_RANK_FRACTION, TARGET_RANK_FRACTION_STEP } from './constants'
import { createRun, evaluateSeasonEnd } from './runState'

function row(teamId: string): StandingsRow {
  return { teamId, wins: 0, losses: 0, winPct: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 }
}

const HIT = [row('us'), row('them')] // rank 1 of 2 -- clears any rankFraction >= 0.5
const MISS = [row('them'), row('us')] // rank 2 of 2 -- fails any rankFraction < 1

describe('createRun', () => {
  it('starts a fresh run at stretch 1, season 1, active, with the starting target', () => {
    const run = createRun('us', 'stacked-guards', 'youth-movement')
    expect(run).toMatchObject({
      teamId: 'us',
      stretchNumber: 1,
      seasonInStretch: 1,
      seasonsPlayed: 0,
      status: 'active',
      target: { rankFraction: STARTING_TARGET_RANK_FRACTION },
    })
  })
})

describe('evaluateSeasonEnd', () => {
  it('hitting the target escalates to a new stretch with a harder target and resets seasonInStretch', () => {
    const run = createRun('us', 'stacked-guards', 'youth-movement')
    const next = evaluateSeasonEnd(run, HIT)
    expect(next.status).toBe('active')
    expect(next.stretchNumber).toBe(2)
    expect(next.seasonInStretch).toBe(1)
    expect(next.seasonsPlayed).toBe(1)
    expect(next.target.rankFraction).toBeCloseTo(STARTING_TARGET_RANK_FRACTION - TARGET_RANK_FRACTION_STEP)
  })

  it('missing the target with chances left burns a season but stays in the same stretch', () => {
    const run = createRun('us', 'stacked-guards', 'youth-movement')
    const next = evaluateSeasonEnd(run, MISS)
    expect(next.status).toBe('active')
    expect(next.stretchNumber).toBe(1)
    expect(next.seasonInStretch).toBe(2)
    expect(next.seasonsPlayed).toBe(1)
    expect(next.target).toEqual(run.target)
  })

  it('missing the target on the final season of a stretch fires the GM', () => {
    let run = createRun('us', 'stacked-guards', 'youth-movement')
    for (let i = 0; i < SEASONS_PER_STRETCH - 1; i++) {
      run = evaluateSeasonEnd(run, MISS)
      expect(run.status).toBe('active')
    }
    run = evaluateSeasonEnd(run, MISS)
    expect(run.status).toBe('fired')
    expect(run.seasonsPlayed).toBe(SEASONS_PER_STRETCH)
  })

  it('a fired run is terminal -- further evaluation is a no-op', () => {
    let run = createRun('us', 'stacked-guards', 'youth-movement')
    for (let i = 0; i < SEASONS_PER_STRETCH; i++) run = evaluateSeasonEnd(run, MISS)
    expect(run.status).toBe('fired')

    const after = evaluateSeasonEnd(run, HIT)
    expect(after).toEqual(run)
  })
})
