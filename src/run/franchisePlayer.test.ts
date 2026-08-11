import { describe, expect, it } from 'vitest'
import { shiftPlayerAttributes } from '../engine/attributeShift'
import { makeTestPlayer } from '../engine/testFixtures'
import { FRANCHISE_PLAYER_MIN } from './constants'
import { ensureFranchisePlayer } from './franchisePlayer'

/** makeTestPlayer hardcodes overallRating at 50 whatever the attributes say, and this function reads
 *  overallRating to decide how far to lift. A zero shift recomputes it from the attributes, which is
 *  the same primitive the real code path uses. */
function rate(player: ReturnType<typeof makeTestPlayer>) {
  return shiftPlayerAttributes(player, 0)
}

/** A roster of flat players, so the only thing that varies is who the guarantee picks. */
function roster(overalls: number[]) {
  return overalls.map((ovr) =>
    rate(
      makeTestPlayer({
        attributes: {
          insideShot: ovr,
          outsideShot: ovr,
          passing: ovr,
          ballHandling: ovr,
          rebounding: ovr,
          perimeterDefense: ovr,
          interiorDefense: ovr,
          speed: ovr,
          lateralQuickness: ovr,
          vertical: ovr,
        },
      }),
    ),
  )
}

describe('ensureFranchisePlayer', () => {
  it('lifts the best starter to the threshold when the roster has nobody there', () => {
    const players = roster([70, 74, 68, 72])
    const startingFive = [players[0].id, players[2].id]
    const result = ensureFranchisePlayer(players, startingFive)

    expect(Math.max(...result.map((p) => p.overallRating))).toBe(FRANCHISE_PLAYER_MIN)
    // The best *starter* (70), not the best player on the roster (74) -- lifting a bench player is
    // exactly the depth-chart bug this release exists to fix.
    expect(result.find((p) => p.id === players[0].id)!.overallRating).toBe(FRANCHISE_PLAYER_MIN)
    expect(result.find((p) => p.id === players[1].id)!.overallRating).toBe(74)
  })

  it('leaves a roster that already has a star completely alone', () => {
    // A floor, not a set: a rolled 88 keeps his 88 rather than being pulled down to the threshold.
    const players = roster([88, 70, 66])
    const result = ensureFranchisePlayer(players, [players[1].id])
    expect(result).toEqual(players)
  })

  it('keeps the lifted player his shape rather than flattening him', () => {
    // A big who finishes and rebounds and cannot shoot, with a full profile rather than a spike over
    // defaults -- a roster of 50s would need so large a lift that the top attributes clamp and tie.
    const spiky = rate(
      makeTestPlayer({
        attributes: {
          insideShot: 80,
          rebounding: 74,
          interiorDefense: 72,
          vertical: 70,
          perimeterDefense: 66,
          speed: 64,
          passing: 62,
          lateralQuickness: 60,
          ballHandling: 58,
          outsideShot: 54,
        },
      }),
    )
    const result = ensureFranchisePlayer([spiky], [spiky.id])
    const lifted = result[0]

    expect(lifted.overallRating).toBeGreaterThanOrEqual(FRANCHISE_PLAYER_MIN)
    // Still that same big, a star to build a system around rather than a flat block of 82s. Only the
    // ordering is asserted: the gaps themselves compress near ATTRIBUTE_CEILING, which is the scale
    // working as intended rather than the lift flattening anyone.
    expect(lifted.attributes.insideShot).toBeGreaterThan(lifted.attributes.rebounding)
    expect(lifted.attributes.rebounding).toBeGreaterThan(lifted.attributes.passing)
    expect(lifted.attributes.passing).toBeGreaterThan(lifted.attributes.outsideShot)
  })

  it('is total on rosters that cannot supply a candidate', () => {
    expect(ensureFranchisePlayer([], [])).toEqual([])
    // No starters named at all -- falls back to the whole roster rather than throwing during setup.
    const players = roster([70, 60])
    expect(Math.max(...ensureFranchisePlayer(players, []).map((p) => p.overallRating))).toBe(FRANCHISE_PLAYER_MIN)
  })
})
