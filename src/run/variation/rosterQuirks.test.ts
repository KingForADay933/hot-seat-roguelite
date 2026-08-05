import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../../engine/rng'
import { makeTestPlayer } from '../../engine/testFixtures'
import { applyRosterQuirk, pickRandomRosterQuirks, ROSTER_QUIRKS } from './rosterQuirks'

function makeRoster(): ReturnType<typeof makeTestPlayer>[] {
  return [
    makeTestPlayer({ positions: ['PG'] }),
    makeTestPlayer({ positions: ['SG'] }),
    makeTestPlayer({ positions: ['SF'] }),
    makeTestPlayer({ positions: ['PF'] }),
    makeTestPlayer({ positions: ['C'] }),
  ]
}

describe('applyRosterQuirk', () => {
  it('stacked-guards boosts PG/SG and nerfs PF/C, leaves SF untouched', () => {
    const roster = makeRoster()
    const result = applyRosterQuirk('stacked-guards', roster, createSeededRng(1))
    const byPosition = Object.fromEntries(result.map((p) => [p.positions[0], p]))

    expect(byPosition.PG.overallRating).toBeGreaterThan(50)
    expect(byPosition.SG.overallRating).toBeGreaterThan(50)
    expect(byPosition.PF.overallRating).toBeLessThan(50)
    expect(byPosition.C.overallRating).toBeLessThan(50)
    expect(byPosition.SF.overallRating).toBe(50)
  })

  it('aging-superstar elevates the best player and ages them, makes everyone else young rookies', () => {
    const roster = makeRoster()
    const boostedAttributes = { ...roster[2].attributes }
    for (const key of Object.keys(boostedAttributes) as (keyof typeof boostedAttributes)[]) boostedAttributes[key] = 80
    roster[2] = { ...roster[2], attributes: boostedAttributes, overallRating: 80 } // SF is the clear best
    const result = applyRosterQuirk('aging-superstar', roster, createSeededRng(2))

    const star = result.find((p) => p.positions[0] === 'SF')!
    expect(star.age).toBeGreaterThanOrEqual(34)
    expect(star.development.ageCurveStage).toBe('declining')
    expect(star.overallRating).toBeGreaterThan(80)

    const rest = result.filter((p) => p.positions[0] !== 'SF')
    expect(rest.every((p) => p.age <= 21)).toBe(true)
    expect(rest.every((p) => p.development.ageCurveStage === 'rising')).toBe(true)
  })

  it('low-ceiling caps potential close to current attributes for every player', () => {
    const roster = makeRoster() // DEFAULT_ATTRIBUTES/POTENTIAL fixture starts with 85 potential vs 50 attributes
    const result = applyRosterQuirk('low-ceiling', roster, createSeededRng(3))

    for (const player of result) {
      for (const key of Object.keys(player.attributes) as (keyof typeof player.attributes)[]) {
        expect(player.development.potential[key] - player.attributes[key]).toBeLessThanOrEqual(4)
        expect(player.development.potential[key]).toBeGreaterThanOrEqual(player.attributes[key])
      }
    }
  })
})

describe('pickRandomRosterQuirks', () => {
  it('returns the requested count of distinct valid quirk ids', () => {
    const rng = createSeededRng(7)
    for (let i = 0; i < 20; i++) {
      const picks = pickRandomRosterQuirks(2, rng)
      expect(picks).toHaveLength(2)
      expect(new Set(picks).size).toBe(2)
      for (const id of picks) expect(Object.keys(ROSTER_QUIRKS)).toContain(id)
    }
  })
})
