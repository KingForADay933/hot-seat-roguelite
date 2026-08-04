import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_FLOOR } from '../constants'
import { makeTestPlayer } from '../testFixtures'
import { growPlayerOneSeason } from './growPlayerOneSeason'
import { ATTRIBUTE_KEYS } from './trainingFocus'

const EVEN_WEIGHTS = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 0.1])) as Record<
  (typeof ATTRIBUTE_KEYS)[number],
  number
>

describe('growPlayerOneSeason (growth path, netDP >= 0)', () => {
  it('never grows an attribute past its potential ceiling', () => {
    const player = makeTestPlayer({
      attributes: { insideShot: 84 },
      development: {
        potential: { insideShot: 85, outsideShot: 85, passing: 85, ballHandling: 85, rebounding: 85, perimeterDefense: 85, interiorDefense: 85, speed: 85, lateralQuickness: 85, vertical: 85 },
      },
    })
    const weights = { ...EVEN_WEIGHTS, insideShot: 1 }
    const grown = growPlayerOneSeason(player, 500, weights)
    expect(grown.attributes.insideShot).toBeLessThanOrEqual(85)
  })

  it('grows a large gap faster than a small gap given the same DP input (ease-out taper)', () => {
    const bigGapPlayer = makeTestPlayer({
      attributes: { insideShot: ATTRIBUTE_FLOOR },
      development: {
        potential: { insideShot: 85, outsideShot: 85, passing: 85, ballHandling: 85, rebounding: 85, perimeterDefense: 85, interiorDefense: 85, speed: 85, lateralQuickness: 85, vertical: 85 },
      },
    })
    const smallGapPlayer = makeTestPlayer({
      attributes: { insideShot: 83 },
      development: {
        potential: { insideShot: 85, outsideShot: 85, passing: 85, ballHandling: 85, rebounding: 85, perimeterDefense: 85, interiorDefense: 85, speed: 85, lateralQuickness: 85, vertical: 85 },
      },
    })
    const weights = { ...EVEN_WEIGHTS, insideShot: 1 }
    const bigGapGrowth = growPlayerOneSeason(bigGapPlayer, 20, weights).attributes.insideShot - ATTRIBUTE_FLOOR
    const smallGapGrowth = growPlayerOneSeason(smallGapPlayer, 20, weights).attributes.insideShot - 83
    expect(bigGapGrowth).toBeGreaterThan(smallGapGrowth)
  })

  it('records netDP onto developmentPoints, fully overwriting any prior value', () => {
    const player = makeTestPlayer({ development: { developmentPoints: 999 } })
    const grown = growPlayerOneSeason(player, 12.5, EVEN_WEIGHTS)
    expect(grown.development.developmentPoints).toBe(12.5)
  })

  it('does not mutate the input player', () => {
    const player = makeTestPlayer({ attributes: { insideShot: 50 } })
    growPlayerOneSeason(player, 20, EVEN_WEIGHTS)
    expect(player.attributes.insideShot).toBe(50)
  })
})

describe('growPlayerOneSeason (decay path, netDP < 0)', () => {
  it('floors decay at ATTRIBUTE_FLOOR', () => {
    const player = makeTestPlayer({ attributes: { insideShot: ATTRIBUTE_FLOOR + 1 } })
    const declined = growPlayerOneSeason(player, -1000, EVEN_WEIGHTS)
    expect(declined.attributes.insideShot).toBe(ATTRIBUTE_FLOOR)
  })

  it('spreads decay evenly across attributes regardless of skewed focus weights', () => {
    const player = makeTestPlayer({ attributes: { insideShot: 60, outsideShot: 60 } })
    const skewedWeights = { ...EVEN_WEIGHTS, insideShot: 1, outsideShot: 0 }
    const declined = growPlayerOneSeason(player, -10, skewedWeights)
    expect(declined.attributes.insideShot).toBeCloseTo(declined.attributes.outsideShot, 5)
    expect(declined.attributes.insideShot).toBeLessThan(60)
  })
})
