import { describe, expect, it } from 'vitest'
import { DP_DECLINE_FLOOR } from '../constants'
import {
  applyCoachingMultiplier,
  computeBaseDP,
  computePlayingTimeBonus,
  computePracticeBonus,
  computeSeasonDP,
} from './dpFormula'

describe('computeBaseDP', () => {
  it('is positive and higher for a younger rising player than an older one', () => {
    expect(computeBaseDP(19, 'rising')).toBeGreaterThan(computeBaseDP(23, 'rising'))
    expect(computeBaseDP(23, 'rising')).toBeGreaterThan(0)
  })

  it('flips from rising to peak at the stage boundary (23 -> 24)', () => {
    const risingAt23 = computeBaseDP(23, 'rising')
    const peakAt24 = computeBaseDP(24, 'peak')
    expect(risingAt23).toBeGreaterThan(peakAt24)
  })

  it('flips from peak to negative decline at the stage boundary (29 -> 30)', () => {
    const peakAt29 = computeBaseDP(29, 'peak')
    const declineAt30 = computeBaseDP(30, 'declining')
    expect(peakAt29).toBeGreaterThan(0)
    expect(declineAt30).toBeLessThan(0)
  })

  it('never drops below DP_DECLINE_FLOOR however old the player gets', () => {
    expect(computeBaseDP(60, 'declining')).toBe(DP_DECLINE_FLOOR)
  })
})

describe('computePlayingTimeBonus', () => {
  it('is 0 for a player who played no minutes', () => {
    expect(computePlayingTimeBonus(0)).toBe(0)
  })

  it('caps at DP_PLAYING_TIME_CAP for very high minutes', () => {
    expect(computePlayingTimeBonus(100000)).toBe(20)
  })
})

describe('computePracticeBonus', () => {
  it('scales linearly from 0 to DP_PRACTICE_BONUS_MAX across the share range', () => {
    expect(computePracticeBonus({ individualDevelopmentShare: 0 })).toBe(0)
    expect(computePracticeBonus({ individualDevelopmentShare: 100 })).toBe(6)
    expect(computePracticeBonus({ individualDevelopmentShare: 50 })).toBeCloseTo(3, 5)
  })
})

describe('applyCoachingMultiplier', () => {
  it('scales a positive pre-multiplier value up for a good coach', () => {
    const neutral = applyCoachingMultiplier(10, 65)
    const good = applyCoachingMultiplier(10, 90)
    expect(good).toBeGreaterThan(neutral)
  })

  it('shrinks the magnitude of a negative pre-multiplier value for a good coach (divides, not multiplies)', () => {
    const neutral = applyCoachingMultiplier(-10, 65)
    const good = applyCoachingMultiplier(-10, 90)
    expect(Math.abs(good)).toBeLessThan(Math.abs(neutral))
  })

  it('grows the magnitude of a negative pre-multiplier value for a bad coach', () => {
    const neutral = applyCoachingMultiplier(-10, 65)
    const bad = applyCoachingMultiplier(-10, 40)
    expect(Math.abs(bad)).toBeGreaterThan(Math.abs(neutral))
  })
})

describe('computeSeasonDP', () => {
  it('composes base + playing-time + practice, then applies the coaching multiplier', () => {
    const dp = computeSeasonDP(19, 'rising', 500, { individualDevelopmentShare: 100 }, 65)
    const base = computeBaseDP(19, 'rising')
    const playingTime = computePlayingTimeBonus(500)
    const practice = computePracticeBonus({ individualDevelopmentShare: 100 })
    expect(dp).toBeCloseTo(base + playingTime + practice, 5) // neutral coaching -> multiplier of 1
  })
})
