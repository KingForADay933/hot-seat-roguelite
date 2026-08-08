import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../testFixtures'
import { ATTRIBUTE_CEILING, ATTRIBUTE_FLOOR, FREE_THROW_PROB_MAX, FREE_THROW_PROB_MIN } from '../constants'
import type { Rng } from '../rng'
import type { PlaySelection } from './playerSelector'
import { freeThrowProbability, resolvePossession } from './outcomeResolver'

function queue(...values: number[]): Rng {
  let i = 0
  return () => values[i++]
}

function queueThenThrowIfCalledAgain(...values: number[]): Rng {
  let i = 0
  return () => {
    if (i >= values.length) throw new Error('rng called more times than expected -- turnover should short-circuit')
    return values[i++]
  }
}

// consistency=100 -> zero-variance gaussian noise, so strength/resistance math is exactly predictable
const deterministicPlayer = (overrides: Parameters<typeof makeTestPlayer>[0] = {}) =>
  makeTestPlayer({ ...overrides, hidden: { consistency: 100, ...overrides.hidden } })

function selectionFor(overrides: Partial<PlaySelection> = {}): PlaySelection {
  return {
    primary: deterministicPlayer(),
    secondaries: [],
    primaryDefender: makeTestPlayer(),
    secondaryDefenders: [],
    isOutsideShotAction: false,
    ...overrides,
  }
}

const NOT_CLUTCH = { possessionNumber: 1, totalPossessions: 100, scoreMargin: 0 }

describe('resolvePossession', () => {
  it('resolves a turnover before ever rolling for a shot outcome', () => {
    // default players -> turnoverProb = 0.1; 0.01 triggers it. A second rng() call would throw.
    const rng = queueThenThrowIfCalledAgain(0.01)
    const result = resolvePossession(
      'isolation',
      selectionFor(),
      50,
      50,
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      rng,
    )
    expect(result).toEqual({ outcome: 'turnover', pointsScored: 0, freeThrowsMade: 0, freeThrowsAttempted: 0 })
  })

  it('resolves a make with 3 points when isOutsideShotAction is true', () => {
    // turnover roll 0.99 (miss the 0.1 turnover band), gaussian u/v inert at consistency=100, make roll 0.1 (< 0.85 clamped makeProb)
    const rng = queue(0.99, 0.5, 0.5, 0.1)
    const result = resolvePossession(
      'spot-up',
      selectionFor({ isOutsideShotAction: true }),
      100,
      0, // margin=100 -> makeProb clamps to 0.85
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      rng,
    )
    expect(result).toEqual({ outcome: 'make', pointsScored: 3, freeThrowsMade: 0, freeThrowsAttempted: 0 })
  })

  it('resolves a make with 2 points when isOutsideShotAction is false', () => {
    const rng = queue(0.99, 0.5, 0.5, 0.1)
    const result = resolvePossession(
      'post-up',
      selectionFor({ isOutsideShotAction: false }),
      100,
      0,
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      rng,
    )
    expect(result).toEqual({ outcome: 'make', pointsScored: 2, freeThrowsMade: 0, freeThrowsAttempted: 0 })
  })

  it('resolves a miss when both the make roll and foul roll fail', () => {
    // margin=0 -> makeProb=0.45, foulProb=0.12 for a non-interior play call (spot-up)
    const rng = queue(0.99, 0.5, 0.5, 0.9, 0.99)
    const result = resolvePossession(
      'spot-up',
      selectionFor({ isOutsideShotAction: true }),
      50,
      50,
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      rng,
    )
    expect(result).toEqual({ outcome: 'miss', pointsScored: 0, freeThrowsMade: 0, freeThrowsAttempted: 0 })
  })

  it('resolves a foul when the make roll fails but the foul roll succeeds, then shoots the free throws', () => {
    // ...0.05 lands in the foul band, then three free-throw rolls. Any FT probability sits inside
    // FREE_THROW_PROB_MIN..MAX (0.55-0.9), so 0.01 always drops and 0.99 never does.
    const rng = queue(0.99, 0.5, 0.5, 0.9, 0.05, 0.01, 0.01, 0.99)
    const result = resolvePossession(
      'spot-up',
      selectionFor({ isOutsideShotAction: true }),
      50,
      50,
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      rng,
    )
    expect(result).toEqual({ outcome: 'foul', pointsScored: 2, freeThrowsMade: 2, freeThrowsAttempted: 3 })
  })

  it('awards two free throws when the foul came on a two-point attempt', () => {
    const rng = queue(0.99, 0.5, 0.5, 0.9, 0.05, 0.01, 0.01)
    const result = resolvePossession(
      'post-up',
      selectionFor({ isOutsideShotAction: false }),
      50,
      50,
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      rng,
    )
    expect(result).toEqual({ outcome: 'foul', pointsScored: 2, freeThrowsMade: 2, freeThrowsAttempted: 2 })
  })

  it('shoots free throws off Outside Shot, so a poor shooter converts fewer', () => {
    // At the attribute floor the probability is FREE_THROW_PROB_MIN (0.55); at the ceiling it's
    // MAX (0.9). A roll of 0.7 therefore misses for the first and drops for the second.
    const brick = deterministicPlayer({ attributes: { outsideShot: ATTRIBUTE_FLOOR } })
    const sharpshooter = deterministicPlayer({ attributes: { outsideShot: ATTRIBUTE_CEILING } })

    expect(freeThrowProbability(brick, false)).toBeCloseTo(FREE_THROW_PROB_MIN, 5)
    expect(freeThrowProbability(sharpshooter, false)).toBeCloseTo(FREE_THROW_PROB_MAX, 5)

    const brickResult = resolvePossession(
      'post-up',
      selectionFor({ primary: brick }),
      50,
      50,
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      queue(0.99, 0.5, 0.5, 0.9, 0.05, 0.7, 0.7),
    )
    const sharpResult = resolvePossession(
      'post-up',
      selectionFor({ primary: sharpshooter }),
      50,
      50,
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      queue(0.99, 0.5, 0.5, 0.9, 0.05, 0.7, 0.7),
    )

    expect(brickResult.freeThrowsMade).toBe(0)
    expect(sharpResult.freeThrowsMade).toBe(2)
  })

  it('raises free-throw probability for a high-Clutch shooter in clutch time only', () => {
    const clutchStar = deterministicPlayer({ hidden: { clutch: 99 } })
    expect(freeThrowProbability(clutchStar, true)).toBeGreaterThan(freeThrowProbability(clutchStar, false))
  })

  it('post-up and pick-and-roll draw fouls more often than other play calls (higher foul probability band)', () => {
    // 0.15 lands in the foul band for post-up/PnR (base 0.12 + 0.08 = 0.20) but not for a non-interior call (base 0.12)
    const interiorRng = queue(0.99, 0.5, 0.5, 0.9, 0.15)
    const perimeterRng = queue(0.99, 0.5, 0.5, 0.9, 0.15)

    const interiorResult = resolvePossession(
      'post-up',
      selectionFor({ isOutsideShotAction: false }),
      50,
      50,
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      interiorRng,
    )
    const perimeterResult = resolvePossession(
      'cutting',
      selectionFor({ isOutsideShotAction: false }),
      50,
      50,
      NOT_CLUTCH.possessionNumber,
      NOT_CLUTCH.totalPossessions,
      NOT_CLUTCH.scoreMargin,
      perimeterRng,
    )

    expect(interiorResult.outcome).toBe('foul')
    expect(perimeterResult.outcome).toBe('miss')
  })

  it('applies no clutch bonus outside the clutch time window even for a high-Clutch player', () => {
    const clutchStar = deterministicPlayer({ hidden: { clutch: 99 } })
    // Far from clutch time (possession 1 of 100): margin stays exactly strength-resistance with no clutch swing.
    const rng = queue(0.99, 0.5, 0.5, 0.451) // makeProb at margin=0 is exactly 0.45; 0.451 should miss
    const result = resolvePossession(
      'spot-up',
      selectionFor({ primary: clutchStar, isOutsideShotAction: true }),
      50,
      50,
      1,
      100,
      0,
      rng,
    )
    expect(result.outcome).not.toBe('make')
  })
})
