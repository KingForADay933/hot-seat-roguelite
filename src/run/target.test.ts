import { describe, expect, it } from 'vitest'
import type { StandingsRow } from '../data/types'
import { MIN_TARGET_RANK_FRACTION, STARTING_TARGET_RANK_FRACTION, TARGET_RANK_FRACTION_STEP } from './constants'
import { hasHitTarget, targetForStretch } from './target'

function row(teamId: string): StandingsRow {
  return { teamId, wins: 0, losses: 0, winPct: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 }
}

describe('targetForStretch', () => {
  it('starts at STARTING_TARGET_RANK_FRACTION on stretch 1', () => {
    expect(targetForStretch(1).rankFraction).toBe(STARTING_TARGET_RANK_FRACTION)
  })

  it('tightens by TARGET_RANK_FRACTION_STEP per stretch', () => {
    expect(targetForStretch(2).rankFraction).toBeCloseTo(STARTING_TARGET_RANK_FRACTION - TARGET_RANK_FRACTION_STEP)
    expect(targetForStretch(3).rankFraction).toBeCloseTo(STARTING_TARGET_RANK_FRACTION - 2 * TARGET_RANK_FRACTION_STEP)
  })

  it('floors at MIN_TARGET_RANK_FRACTION and never goes below it', () => {
    expect(targetForStretch(20).rankFraction).toBe(MIN_TARGET_RANK_FRACTION)
  })
})

describe('hasHitTarget', () => {
  const standings = [row('a'), row('b'), row('c'), row('d')] // pre-sorted best -> worst, as computeStandings guarantees

  it('is true when a team ranks at or above the fraction cutoff', () => {
    expect(hasHitTarget(standings, 'a', { rankFraction: 0.5 })).toBe(true) // rank 1 of 4, cutoff ceil(4*0.5)=2
    expect(hasHitTarget(standings, 'b', { rankFraction: 0.5 })).toBe(true) // rank 2 of 4
  })

  it('is false when a team ranks below the fraction cutoff', () => {
    expect(hasHitTarget(standings, 'c', { rankFraction: 0.5 })).toBe(false) // rank 3 of 4
    expect(hasHitTarget(standings, 'd', { rankFraction: 0.5 })).toBe(false) // rank 4 of 4
  })

  it('rounds the cutoff up so a fractional target still admits at least one extra team', () => {
    // ceil(4 * 0.3) = 2, so rank 2 still qualifies even though 4*0.3=1.2 alone would only fit rank 1
    expect(hasHitTarget(standings, 'b', { rankFraction: 0.3 })).toBe(true)
  })

  it('throws if the team is not present in the standings', () => {
    expect(() => hasHitTarget(standings, 'nowhere', { rankFraction: 0.5 })).toThrow()
  })
})
