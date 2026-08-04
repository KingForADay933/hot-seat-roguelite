import { describe, expect, it } from 'vitest'
import { makeTestFive, makeTestPlayer } from './testFixtures'
import { findAtPosition, rawOverallQuality, sortByPosition } from './matchup'

describe('sortByPosition', () => {
  it('orders players PG, SG, SF, PF, C', () => {
    const shuffled = [
      makeTestPlayer({ positions: ['C'] }),
      makeTestPlayer({ positions: ['PG'] }),
      makeTestPlayer({ positions: ['PF'] }),
      makeTestPlayer({ positions: ['SG'] }),
      makeTestPlayer({ positions: ['SF'] }),
    ]
    const sorted = sortByPosition(shuffled)
    expect(sorted.map((p) => p.positions[0])).toEqual(['PG', 'SG', 'SF', 'PF', 'C'])
  })
})

describe('findAtPosition', () => {
  it('returns the player occupying a given position', () => {
    const five = makeTestFive()
    expect(findAtPosition('SF', five)).toBe(five[2])
  })

  it('returns undefined when no player occupies that position', () => {
    const guardsOnly = [makeTestPlayer({ positions: ['PG'] }), makeTestPlayer({ positions: ['SG'] })]
    expect(findAtPosition('C', guardsOnly)).toBeUndefined()
  })
})

describe('rawOverallQuality', () => {
  it('matches a hand-computed average of the 10 attributes', () => {
    const player = makeTestPlayer({
      attributes: {
        insideShot: 60,
        outsideShot: 70,
        passing: 50,
        ballHandling: 40,
        rebounding: 80,
        perimeterDefense: 30,
        interiorDefense: 90,
        speed: 20,
        lateralQuickness: 10,
        vertical: 100,
      },
    })
    const expected = (60 + 70 + 50 + 40 + 80 + 30 + 90 + 20 + 10 + 100) / 10
    expect(rawOverallQuality(player)).toBeCloseTo(expected, 5)
  })

  it('ignores the cached overallRating field entirely', () => {
    const player = makeTestPlayer()
    player.overallRating = 999 // decoy value, must never be read
    expect(rawOverallQuality(player)).toBeCloseTo(50, 5) // true average of all-default (50) attributes
  })
})
