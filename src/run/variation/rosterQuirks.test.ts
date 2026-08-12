import { describe, expect, it } from 'vitest'
import { shiftPlayerAttributes } from '../../engine/attributeShift'
import { ATTRIBUTE_FLOOR } from '../../engine/constants'
import { deriveDepthChart } from '../../engine/depthChart'
import { createSeededRng } from '../../engine/rng'
import { makeTestPlayer } from '../../engine/testFixtures'
import { FRANCHISE_PLAYER_MIN } from '../constants'
import { ensureFranchisePlayer } from '../franchisePlayer'
import { applyRosterQuirk, pickRandomRosterQuirks, ROSTER_QUIRKS } from './rosterQuirks'

/** ui/playerTags.ts's DURABILITY_LOW. Duplicated rather than imported: run/ must not depend on ui/,
 *  and the point of the assertion is precisely that the two files agree about this number. */
const DURABILITY_TAG_THRESHOLD = 42

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

describe('applyRosterQuirk / positional tilt', () => {
  it('frontcourt-overload is the exact mirror of stacked-guards', () => {
    const stacked = applyRosterQuirk('stacked-guards', makeRoster(), createSeededRng(1))
    const overloaded = applyRosterQuirk('frontcourt-overload', makeRoster(), createSeededRng(1))
    const byPosition = Object.fromEntries(overloaded.map((p) => [p.positions[0], p]))

    expect(byPosition.PF.overallRating).toBeGreaterThan(50)
    expect(byPosition.C.overallRating).toBeGreaterThan(50)
    expect(byPosition.PG.overallRating).toBeLessThan(50)
    expect(byPosition.SG.overallRating).toBeLessThan(50)
    expect(byPosition.SF.overallRating).toBe(50)

    // Same magnitude in both directions, so neither tilt is the harsher draft option.
    const stackedByPosition = Object.fromEntries(stacked.map((p) => [p.positions[0], p]))
    expect(byPosition.PF.overallRating).toBe(stackedByPosition.PG.overallRating)
    expect(byPosition.PG.overallRating).toBe(stackedByPosition.PF.overallRating)
  })
})

describe('applyRosterQuirk / skill shape', () => {
  it('live-by-three trades finishing and rim protection for outside shooting, at no net cost', () => {
    const result = applyRosterQuirk('live-by-three', makeRoster(), createSeededRng(4))

    for (const player of result) {
      expect(player.attributes.outsideShot).toBeGreaterThan(50)
      expect(player.attributes.insideShot).toBeLessThan(50)
      expect(player.attributes.interiorDefense).toBeLessThan(50)
      // What the raised attribute gains, the lowered ones give back -- a skill quirk changes what a
      // roster is good at, not how good it is.
      expect(player.overallRating).toBe(50)
    }
  })

  it('defense-first is the same trade run the other way', () => {
    const result = applyRosterQuirk('defense-first', makeRoster(), createSeededRng(5))

    for (const player of result) {
      expect(player.attributes.perimeterDefense).toBeGreaterThan(50)
      expect(player.attributes.interiorDefense).toBeGreaterThan(50)
      expect(player.attributes.insideShot).toBeLessThan(50)
      expect(player.attributes.outsideShot).toBeLessThan(50)
      expect(player.overallRating).toBe(50)
    }
  })

  it('undersized-fast trades the glass for quickness and physically shrinks the roster', () => {
    const roster = makeRoster()
    const result = applyRosterQuirk('undersized-fast', roster, createSeededRng(6))

    result.forEach((player, i) => {
      expect(player.attributes.speed).toBeGreaterThan(50)
      expect(player.attributes.lateralQuickness).toBeGreaterThan(50)
      expect(player.attributes.rebounding).toBeLessThan(50)
      expect(player.attributes.interiorDefense).toBeLessThan(50)
      expect(player.overallRating).toBe(50)
      // Height is flavour at a player's own slot (effectivePlayer is a no-op there) but it is what
      // makes the roster read as small, so it has to actually move.
      expect(player.heightInches).toBeLessThan(roster[i].heightInches)
    })
  })
})

describe('applyRosterQuirk / all-prime', () => {
  it('puts everyone in their prime with nothing left to develop', () => {
    const result = applyRosterQuirk('all-prime', makeRoster(), createSeededRng(8))

    for (const player of result) {
      expect(player.age).toBeGreaterThanOrEqual(26)
      expect(player.age).toBeLessThanOrEqual(29)
      expect(player.development.ageCurveStage).toBe('peak')
      for (const key of Object.keys(player.attributes) as (keyof typeof player.attributes)[]) {
        expect(player.development.potential[key]).toBe(player.attributes[key])
      }
    }
  })

  it('freezes the roster in both directions, unlike low-ceiling which leaves the age curve alone', () => {
    const roster = makeRoster().map((p) => ({ ...p, age: 34, development: { ...p.development, ageCurveStage: 'declining' as const } }))

    expect(applyRosterQuirk('all-prime', roster, createSeededRng(9)).every((p) => p.development.ageCurveStage === 'peak')).toBe(true)
    expect(applyRosterQuirk('low-ceiling', roster, createSeededRng(9)).every((p) => p.development.ageCurveStage === 'declining')).toBe(true)
  })
})

describe('applyRosterQuirk / high-variance', () => {
  /** Ranked roster -- makeTestPlayer pins overallRating at 50 regardless of attributes, so the
   *  ranking the quirk reads has to be set explicitly. */
  function makeRankedRoster(): ReturnType<typeof makeTestPlayer>[] {
    return makeRoster().map((p, i) => ({ ...p, overallRating: 70 - i * 5 })) // 70, 65, 60, 55, 50
  }

  it('gives the best two real headroom and takes the worst two down with none', () => {
    const roster = makeRankedRoster()
    const result = applyRosterQuirk('high-variance', roster, createSeededRng(10))
    const byId = new Map(result.map((p) => [p.id, p]))

    for (const best of roster.slice(0, 2)) {
      const after = byId.get(best.id)!
      expect(after.attributes.insideShot).toBe(best.attributes.insideShot) // upside is potential, not a free bump
      expect(after.development.potential.insideShot).toBeGreaterThan(best.attributes.insideShot)
    }

    for (const worst of roster.slice(-2)) {
      const after = byId.get(worst.id)!
      expect(after.overallRating).toBeLessThan(worst.overallRating)
      expect(after.development.potential.insideShot).toBe(after.attributes.insideShot) // and no way back
    }
  })

  it('leaves the middle of the roster alone -- the spread is the point', () => {
    const roster = makeRankedRoster()
    const result = applyRosterQuirk('high-variance', roster, createSeededRng(11))
    const middle = result.find((p) => p.id === roster[2].id)!
    expect(middle).toEqual(roster[2])
  })

  it('does not let the two ends overlap on a roster too small to have two', () => {
    const tiny = [makeTestPlayer({ positions: ['PG'] }), makeTestPlayer({ positions: ['SG'] })].map((p, i) => ({
      ...p,
      overallRating: 70 - i * 10,
    }))
    const result = applyRosterQuirk('high-variance', tiny, createSeededRng(12))

    // Both are risers on a two-man roster; neither may also be docked as a faller.
    for (const player of result) {
      expect(player.overallRating).toBe(tiny.find((p) => p.id === player.id)!.overallRating)
    }
  })
})

describe('applyRosterQuirk / glass-cannons', () => {
  it('puts every player at the durability floor, where the roster screen already names the problem', () => {
    const result = applyRosterQuirk('glass-cannons', makeRoster(), createSeededRng(13))

    for (const player of result) {
      // The quirk carries no UI of its own -- it is legible because ui/playerTags.ts tags "Gasses Out"
      // at 42 and My Team's Scouting section prints the number. Both depend on this holding.
      expect(player.hidden.durability).toBeLessThanOrEqual(DURABILITY_TAG_THRESHOLD)
      expect(player.hidden.durability).toBeGreaterThanOrEqual(ATTRIBUTE_FLOOR)
      expect(player.overallRating).toBeGreaterThan(50) // and the skill it buys is real
    }
  })

  it('leaves the traits it is not about alone', () => {
    const roster = makeRoster()
    const result = applyRosterQuirk('glass-cannons', roster, createSeededRng(14))
    result.forEach((player, i) => {
      expect(player.hidden.consistency).toBe(roster[i].hidden.consistency)
      expect(player.hidden.clutch).toBe(roster[i].hidden.clutch)
    })
  })
})

describe('applyRosterQuirk / one-superstar', () => {
  /** Full profiles rather than spikes over defaults: a lift this large clamps at ATTRIBUTE_CEILING on
   *  a roster of 50s, and tied-at-the-ceiling attributes make "did he reach 90" untestable. Rated
   *  through a zero shift because makeTestPlayer pins overallRating at 50 whatever the attributes say
   *  -- the same helper franchisePlayer.test.ts uses, for the same reason. */
  function ratedRoster(): ReturnType<typeof makeTestPlayer>[] {
    return (['PG', 'SG', 'SF', 'PF', 'C', 'PG'] as const).map((position, i) =>
      shiftPlayerAttributes(
        makeTestPlayer({
          positions: [position],
          attributes: {
            insideShot: 74 - i, outsideShot: 70 - i, passing: 68 - i, ballHandling: 72 - i, rebounding: 66 - i,
            perimeterDefense: 71 - i, interiorDefense: 64 - i, speed: 73 - i, lateralQuickness: 69 - i, vertical: 67 - i,
          },
        }),
        0,
      ),
    )
  }

  it('lifts one starter to the target and taxes everyone else for it', () => {
    const roster = ratedRoster()
    const result = applyRosterQuirk('one-superstar', roster, createSeededRng(15))

    const star = result.reduce((top, p) => (p.overallRating > top.overallRating ? p : top))
    expect(star.overallRating).toBeGreaterThanOrEqual(90)

    for (const player of result) {
      if (player.id === star.id) continue
      expect(player.overallRating).toBeLessThan(roster.find((p) => p.id === player.id)!.overallRating)
    }
  })

  it('never picks a bench player, so the star is not sitting behind someone worse', () => {
    // The sixth man is the roster's best on purpose: a quirk that read "best available" rather than
    // "best at each position" would pick him and re-create the depth-chart inversion.
    for (let seed = 0; seed < 12; seed++) {
      const roster = ratedRoster()
      const five = new Set(deriveDepthChart(roster).startingFive)
      const result = applyRosterQuirk('one-superstar', roster, createSeededRng(seed + 20))
      const star = result.reduce((top, p) => (p.overallRating > top.overallRating ? p : top))
      expect(five.has(star.id)).toBe(true)
    }
  })
})

describe('applyRosterQuirk / no-weak-links', () => {
  function spreadRoster(): ReturnType<typeof makeTestPlayer>[] {
    return makeRoster().map((p, i) => shiftPlayerAttributes(p, 22 - i * 6)) // 72, 66, 60, 54, 48
  }

  it('lands the best man exactly on the franchise threshold, so the guarantee never fires', () => {
    // The whole reason the quirk slides its band upward rather than downward: RunProvider calls
    // ensureFranchisePlayer immediately after this, and a roster with no 82 would have one lifted
    // straight back out of the flat band this exists to produce.
    const result = applyRosterQuirk('no-weak-links', spreadRoster(), createSeededRng(16))
    expect(Math.max(...result.map((p) => p.overallRating))).toBe(FRANCHISE_PLAYER_MIN)

    const startingFive = deriveDepthChart(result).startingFive
    expect(ensureFranchisePlayer(result, startingFive)).toEqual(result)
  })

  it('compresses the roster rather than merely raising it', () => {
    const roster = spreadRoster()
    const result = applyRosterQuirk('no-weak-links', roster, createSeededRng(17))
    const spread = (ps: typeof roster) => Math.max(...ps.map((p) => p.overallRating)) - Math.min(...ps.map((p) => p.overallRating))

    // Measured across 64 generated rosters: a 22.4-point spread comes back as 8.0.
    expect(spread(result)).toBeLessThan(spread(roster) / 2)
    // Distinct from low-ceiling, which is about potential -- this one does not touch it.
    result.forEach((player, i) => expect(player.development.potential).toEqual(roster[i].development.potential))
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
