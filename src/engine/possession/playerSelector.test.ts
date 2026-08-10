import { describe, expect, it } from 'vitest'
import { DEFENSIVE_SCHEMES } from '../../data/presets'
import { slotByPosition } from '../matchup'
import { createSeededRng } from '../rng'
import { makeTestFive, makeTestPlayer } from '../testFixtures'
import { getInvolvedPlayerIds, selectPlayers } from './playerSelector'

const manToMan = DEFENSIVE_SCHEMES.manToMan
const switchEverything = DEFENSIVE_SCHEMES.switchEverything

/** Runs selectPlayers many times with varying seeds and tallies how often each offense player was primary. */
function tallyPrimaryUsage(
  playCall: Parameters<typeof selectPlayers>[0],
  offense: ReturnType<typeof makeTestFive>,
  defense: ReturnType<typeof makeTestFive>,
  scheme: typeof manToMan,
  trials: number,
): Map<string, number> {
  const counts = new Map(offense.map((p) => [p.id, 0]))
  for (let seed = 0; seed < trials; seed++) {
    const selection = selectPlayers(playCall, slotByPosition(offense), slotByPosition(defense), scheme, createSeededRng(seed))
    counts.set(selection.primary.id, (counts.get(selection.primary.id) ?? 0) + 1)
  }
  return counts
}

describe('selectPlayers', () => {
  it('usage is weighted toward the best-fit player but spreads across the roster', () => {
    const offense = makeTestFive()
    offense[2].attributes.ballHandling = 95
    offense[2].attributes.passing = 95 // SF is the clear best PnR handler
    const defense = makeTestFive()

    const counts = tallyPrimaryUsage('pick-and-roll', offense, defense, manToMan, 300)
    const starUsage = counts.get(offense[2].id) ?? 0
    const othersUsage = [...counts.entries()].filter(([id]) => id !== offense[2].id)

    expect(starUsage).toBeGreaterThan(150) // clear majority of 300 trials
    expect(othersUsage.some(([, count]) => count > 0)).toBe(true) // but not exclusive
  })

  it('spreads usage roughly evenly when all players are equally suited', () => {
    const offense = makeTestFive()
    const defense = makeTestFive()

    const counts = tallyPrimaryUsage('isolation', offense, defense, manToMan, 300)
    // every player should get picked sometimes, and no single player should dominate
    expect([...counts.values()].every((count) => count > 0)).toBe(true)
    expect(Math.max(...counts.values())).toBeLessThan(150) // well under 100% of trials
  })

  it('flags isolation as an outside-shot action when outsideShot beats insideShot, regardless of who is picked', () => {
    const offense = makeTestFive()
    offense.forEach((p) => {
      p.attributes.outsideShot = 70
      p.attributes.insideShot = 40
    })
    const defense = makeTestFive()

    for (let seed = 0; seed < 20; seed++) {
      const selection = selectPlayers('isolation', slotByPosition(offense), slotByPosition(defense), manToMan, createSeededRng(seed))
      expect(selection.isOutsideShotAction).toBe(true)
    }
  })

  it('spot-up always flags as an outside-shot action regardless of shooter attributes', () => {
    const offense = makeTestFive()
    const defense = makeTestFive()
    const selection = selectPlayers('spot-up', slotByPosition(offense), slotByPosition(defense), manToMan, createSeededRng(2))
    expect(selection.isOutsideShotAction).toBe(true)
  })

  it('uses the fixed position matchup under Man-to-Man, regardless of which offense player is picked', () => {
    const offense = makeTestFive()
    const defense = makeTestFive()

    for (let seed = 0; seed < 20; seed++) {
      const selection = selectPlayers('pick-and-roll', slotByPosition(offense), slotByPosition(defense), manToMan, createSeededRng(seed))
      const expectedDefender = defense[offense.indexOf(selection.primary)]
      expect(selection.primaryDefender).toBe(expectedDefender)
    }
  })

  it('Switch-Everything always picks the worst perimeter defender among all five, not the assigned matchup', () => {
    const offense = makeTestFive()
    const defense = makeTestFive()
    // Make the SF (defense[2]) the worst perimeter defender on the roster
    defense[2].attributes.lateralQuickness = 10
    defense[2].attributes.perimeterDefense = 10

    for (let seed = 0; seed < 20; seed++) {
      const selection = selectPlayers('pick-and-roll', slotByPosition(offense), slotByPosition(defense), switchEverything, createSeededRng(seed))
      expect(selection.primaryDefender).toBe(defense[2])
    }
  })

  it('transition is defended by the assigned matchup, not by the fastest player on the floor', () => {
    // This used to be pickBest(defense, scoreSpeed): a fast break faced the opponent's quickest
    // defender every single time, making transition the one play call that always drew the best
    // available defense. A break happens precisely because the defense is *not* set, and that
    // inversion was most of why transition was the engine's least efficient play call by a wide
    // margin (0.917 points per play, against 1.14 now). See engine/playCallEfficiency.test.ts.
    const offense = makeTestFive()
    const defense = makeTestFive()
    defense[3].attributes.speed = 99 // PF is fastest, and is not who the ball-handler is matched to

    let sawSomeoneElse = false
    for (let seed = 0; seed < 20; seed++) {
      const selection = selectPlayers('transition', slotByPosition(offense), slotByPosition(defense), manToMan, createSeededRng(seed))
      // The defender is whoever is assigned to the player who actually got the ball, so it tracks
      // the handler across seeds rather than being pinned to one man.
      const handlerSlot = offense.indexOf(selection.primary)
      expect(selection.primaryDefender).toBe(defense[handlerSlot])
      if (selection.primaryDefender !== defense[3]) sawSomeoneElse = true
    }
    expect(sawSomeoneElse).toBe(true)
  })

  it('getInvolvedPlayerIds returns a deduplicated union of all selected players', () => {
    const offense = makeTestFive()
    const defense = makeTestFive()
    const selection = selectPlayers('pick-and-roll', slotByPosition(offense), slotByPosition(defense), manToMan, createSeededRng(3))
    const ids = getInvolvedPlayerIds(selection)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(selection.primary.id)
    expect(ids).toContain(selection.primaryDefender.id)
  })

  it('does not crash with a single-position roster edge case', () => {
    const offense = Array.from({ length: 5 }, () => makeTestPlayer({ positions: ['C'] }))
    const defense = Array.from({ length: 5 }, () => makeTestPlayer({ positions: ['C'] }))
    expect(() => selectPlayers('post-up', slotByPosition(offense), slotByPosition(defense), manToMan, createSeededRng(4))).not.toThrow()
  })
})
