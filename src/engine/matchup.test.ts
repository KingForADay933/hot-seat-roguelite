import { describe, expect, it } from 'vitest'
import { makeTestFive, makeTestPlayer } from './testFixtures'
import { buildMatchups, findAtSlot, rawOverallQuality, slotByPosition, sortByPosition } from './matchup'

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

describe('findAtSlot', () => {
  it('returns whoever is filling a given slot', () => {
    const five = slotByPosition(makeTestFive())
    expect(findAtSlot('SF', five)).toBe(five[2].player)
  })

  it('returns undefined when nobody is filling that slot', () => {
    const guardsOnly = slotByPosition([makeTestPlayer({ positions: ['PG'] }), makeTestPlayer({ positions: ['SG'] })])
    expect(findAtSlot('C', guardsOnly)).toBeUndefined()
  })

  it('finds by slot, not by the occupant\'s own listed position', () => {
    // A center filling the PG slot: findable at PG, absent at C.
    const bigAtGuard = makeTestPlayer({ positions: ['C'] })
    const five = [{ player: bigAtGuard, slot: 'PG' as const }]
    expect(findAtSlot('PG', five)).toBe(bigAtGuard)
    expect(findAtSlot('C', five)).toBeUndefined()
  })
})

describe('buildMatchups', () => {
  it('pairs slot against slot, PG through C', () => {
    const offense = slotByPosition(makeTestFive())
    const defense = slotByPosition(makeTestFive())

    const matchups = buildMatchups(offense, defense)
    offense.forEach((entry, i) => {
      expect(matchups.get(entry.player.id)).toBe(defense[i].player)
    })
  })

  it('honours an out-of-position assignment instead of re-sorting back into position order', () => {
    // The whole reason slots exist: a guard charted at C should guard the opposing C, even though
    // sorting by his own listed position would have put him on the PG.
    const guard = makeTestPlayer({ positions: ['PG'], name: 'Guard at centre' })
    const offense = [{ player: guard, slot: 'C' as const }]
    const opposingCentre = makeTestPlayer({ positions: ['C'], name: 'Real centre' })
    const defense = [{ player: opposingCentre, slot: 'C' as const }]

    expect(buildMatchups(offense, defense).get(guard.id)).toBe(opposingCentre)
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
