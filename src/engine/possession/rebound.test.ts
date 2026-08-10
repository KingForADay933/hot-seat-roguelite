import { describe, expect, it } from 'vitest'
import type { Player } from '../../data/types'
import { createSeededRng } from '../rng'
import { makeTestPlayer } from '../testFixtures'
import { offensiveReboundProbability, pickRebounder, reboundContestScore } from './rebound'

/** A centre-ish profile: strong on the glass and big. */
function big(name: string): Player {
  return makeTestPlayer({ name, attributes: { rebounding: 75, interiorDefense: 75, vertical: 75 } })
}

/** A guard-ish profile: the same Rebounding rating, but none of the size. */
function guard(name: string): Player {
  return makeTestPlayer({ name, attributes: { rebounding: 75, interiorDefense: 35, vertical: 35 } })
}

function shareOf(five: Player[], target: Player, draws = 20000): number {
  const rng = createSeededRng(4)
  let hits = 0
  for (let i = 0; i < draws; i++) if (pickRebounder(five, rng).id === target.id) hits += 1
  return hits / draws
}

describe('reboundContestScore', () => {
  it('separates two players with identical Rebounding by their size', () => {
    // The case the old attribute-only weighting could not tell apart at all.
    expect(reboundContestScore(big('B'))).toBeGreaterThan(reboundContestScore(guard('G')))
  })

  it('still moves with the Rebounding attribute itself', () => {
    const better = makeTestPlayer({ attributes: { rebounding: 80 } })
    const worse = makeTestPlayer({ attributes: { rebounding: 40 } })
    expect(reboundContestScore(better)).toBeGreaterThan(reboundContestScore(worse))
  })
})

describe('pickRebounder', () => {
  it('gives the big a clearly larger share than an equally-rated guard beside him', () => {
    const b = big('Big')
    const five = [b, guard('G1'), guard('G2'), guard('G3'), guard('G4')]
    const share = shareOf(five, b)

    // An even split is 0.20, and the flat weighting this replaced gave exactly that here, because
    // every player in this five has the same Rebounding rating -- size was invisible to it. The big
    // now takes roughly a third of the boards, about 1.7x his share of the floor.
    expect(share).toBeGreaterThan(0.3)
    expect(share).toBeLessThan(0.45)
  })

  it('concentrates boards on the best rebounder rather than splitting them evenly', () => {
    const best = makeTestPlayer({ attributes: { rebounding: 85, interiorDefense: 85, vertical: 85 } })
    const rest = Array.from({ length: 4 }, () => makeTestPlayer({ attributes: { rebounding: 55, interiorDefense: 55, vertical: 55 } }))
    const share = shareOf([best, ...rest], best)

    expect(share).toBeGreaterThan(0.4)
    // ...but never monopolises: four other bodies on the floor still come down with some.
    expect(share).toBeLessThan(0.75)
  })

  it('always returns someone from the five it was given', () => {
    const five = [big('B'), guard('G1'), guard('G2'), guard('G3'), guard('G4')]
    const ids = new Set(five.map((p) => p.id))
    const rng = createSeededRng(9)
    for (let i = 0; i < 500; i++) expect(ids.has(pickRebounder(five, rng).id)).toBe(true)
  })

  it('consumes exactly one rng draw, so existing seeds still reproduce their games', () => {
    // The weighting changes who gets credited, never how much randomness is spent -- which is what
    // keeps this a pure attribution change rather than one that reshuffles every later possession.
    let calls = 0
    const counting = () => {
      calls += 1
      return 0.5
    }
    pickRebounder([big('B'), guard('G1'), guard('G2'), guard('G3'), guard('G4')], counting)
    expect(calls).toBe(1)
  })

  it('degrades to the one player available rather than throwing', () => {
    const lone = big('Alone')
    expect(pickRebounder([lone], createSeededRng(1)).id).toBe(lone.id)
  })
})

describe('offensiveReboundProbability', () => {
  it('is unchanged by the rebounder weighting -- it decides possession, not credit', () => {
    const offense = Array.from({ length: 5 }, () => makeTestPlayer({ attributes: { rebounding: 50 } }))
    const defense = Array.from({ length: 5 }, () => makeTestPlayer({ attributes: { rebounding: 50 } }))
    // Evenly matched fives sit exactly on the base rate, with no size term anywhere in sight.
    expect(offensiveReboundProbability(offense, defense)).toBeCloseTo(0.25, 10)
  })

  it('still favours the better rebounding team', () => {
    const strong = Array.from({ length: 5 }, () => makeTestPlayer({ attributes: { rebounding: 80 } }))
    const weak = Array.from({ length: 5 }, () => makeTestPlayer({ attributes: { rebounding: 40 } }))
    expect(offensiveReboundProbability(strong, weak)).toBeGreaterThan(offensiveReboundProbability(weak, strong))
  })
})
