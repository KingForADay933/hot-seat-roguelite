import { describe, expect, it } from 'vitest'
import { OFFENSIVE_PLAYBOOKS } from '../../data/presets'
import { createSeededRng } from '../../engine/rng'
import { makeTestPlayer } from '../../engine/testFixtures'
import { computeInitialSynergyScore, pickRandomSystems } from './systemDraft'

describe('pickRandomSystems', () => {
  it('returns the requested count of distinct valid system ids', () => {
    const rng = createSeededRng(1)
    for (let i = 0; i < 20; i++) {
      const picks = pickRandomSystems(3, rng)
      expect(picks).toHaveLength(3)
      expect(new Set(picks).size).toBe(3)
      for (const id of picks) expect(Object.keys(OFFENSIVE_PLAYBOOKS)).toContain(id)
    }
  })
})

describe('computeInitialSynergyScore', () => {
  it('scores a post-heavy roster well against Twin Towers (post-up-weighted)', () => {
    const bigs = Array.from({ length: 5 }, () =>
      makeTestPlayer({ attributes: { insideShot: 90, vertical: 90, rebounding: 90, outsideShot: 30, ballHandling: 30, passing: 30, speed: 30 } }),
    )
    const score = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, bigs)
    // Twin Towers still weights pick-and-roll at 0.25, which also reads ballHandling/passing (low
    // for a pure-post roster), so this doesn't approach 90 -- just clearly above SYNERGY_NEUTRAL (65).
    expect(score).toBeGreaterThan(65)
  })

  it('scores the same post-heavy roster poorly against 7 Seconds or Less (transition/spot-up-weighted)', () => {
    const bigs = Array.from({ length: 5 }, () =>
      makeTestPlayer({ attributes: { insideShot: 90, vertical: 90, rebounding: 90, outsideShot: 30, ballHandling: 30, passing: 30, speed: 30 } }),
    )
    const score = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.sevenSecondsOrLess, bigs)
    expect(score).toBeLessThan(50)
  })

  it('a guard-heavy roster synergizes with 7 Seconds or Less better than with Twin Towers -- the anti-synergy pairing', () => {
    const guards = Array.from({ length: 5 }, () =>
      makeTestPlayer({ attributes: { speed: 90, passing: 90, outsideShot: 90, ballHandling: 90, insideShot: 30, vertical: 30, rebounding: 30 } }),
    )
    const fastBreakScore = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.sevenSecondsOrLess, guards)
    const postScore = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, guards)
    expect(fastBreakScore).toBeGreaterThan(postScore)
  })

  it('falls back to a neutral score for an empty roster rather than dividing by zero', () => {
    expect(computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.balanced, [])).toBe(65)
  })

  it('returns a value in the attribute-ish 40-99 range for a plausible average roster', () => {
    const roster = Array.from({ length: 5 }, () => makeTestPlayer())
    const score = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.balanced, roster)
    expect(score).toBeGreaterThanOrEqual(40)
    expect(score).toBeLessThanOrEqual(99)
  })
})
