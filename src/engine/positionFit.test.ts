import { describe, expect, it } from 'vitest'
import type { Player, Position } from '../data/types'
import { generateLeague } from './generator/randomLeague'
import { createSeededRng } from './rng'
import { makeTestPlayer } from './testFixtures'
import {
  attributeSpread,
  effectiveFive,
  effectivePlayer,
  heightBandsContaining,
  heightMisfitInches,
  isPositionless,
  isSpecialist,
  positionFitSeverityMultiplier,
  positionRelativeSpread,
  slotSlideDistance,
} from './positionFit'

describe('slotSlideDistance', () => {
  it('is 0 for the same slot', () => {
    expect(slotSlideDistance('SF', 'SF')).toBe(0)
  })

  it('counts slots apart in PG-SG-SF-PF-C order', () => {
    expect(slotSlideDistance('PG', 'SG')).toBe(1)
    expect(slotSlideDistance('PG', 'C')).toBe(4)
    expect(slotSlideDistance('C', 'PG')).toBe(4)
  })
})

describe('heightMisfitInches', () => {
  it('is 0 for a height already inside the slot band', () => {
    expect(heightMisfitInches(74, 'PG')).toBe(0)
  })

  // rotation-charts.md Section 4's own worked examples.
  it('bites a 6\'3" PG (75") two inches short of SF\'s 77" floor', () => {
    expect(heightMisfitInches(75, 'SF')).toBe(2)
  })

  it('leaves a 6\'9" SF (81") free at PF but one inch short of C\'s 82" floor', () => {
    expect(heightMisfitInches(81, 'PF')).toBe(0)
    expect(heightMisfitInches(81, 'C')).toBe(1)
  })

  it('measures past the top of the band the same way it measures past the bottom', () => {
    expect(heightMisfitInches(90, 'C')).toBe(2)
  })
})

describe('heightBandsContaining', () => {
  it('returns every position whose band overlaps the height, not just one', () => {
    // The doc's own "genuinely 6\'9\" player" example -- inside both SF's and PF's bands.
    expect(heightBandsContaining(81)).toEqual(['SF', 'PF'])
  })

  it('returns a single position when the height sits in only one band', () => {
    expect(heightBandsContaining(79)).toEqual(['SF'])
  })
})

describe('attributeSpread', () => {
  it('is 0 for a perfectly flat profile', () => {
    expect(attributeSpread(makeTestPlayer())).toBe(0)
  })

  it('is the gap between the best and worst attribute', () => {
    const player = makeTestPlayer({ attributes: { insideShot: 90, passing: 30 } })
    expect(attributeSpread(player)).toBe(60)
  })
})

describe('isPositionless / isSpecialist', () => {
  it('flags a multi-band height with a flat attribute profile as Positionless', () => {
    const player = makeTestPlayer({ positions: ['SF'], heightInches: 81 })
    expect(isPositionless(player)).toBe(true)
    expect(isSpecialist(player)).toBe(false)
  })

  it('does not call a multi-band player Positionless once the attribute profile spikes', () => {
    const player = makeTestPlayer({ positions: ['SF'], heightInches: 81, attributes: { insideShot: 95, passing: 30 } })
    expect(isPositionless(player)).toBe(false)
  })

  it('does not flag a height at the extreme edge of a band, on its own, as Specialist', () => {
    // PG's own band is 72-76" and C's is 82-88", so these two sit exactly on a floor and a ceiling.
    // That used to be enough on its own; it no longer is. effectivePlayer already charges an extreme
    // height per inch through heightMisfitInches, and the bands are narrow enough that a quarter of
    // every position lands on an edge -- see isSpecialist's comment.
    expect(isSpecialist(makeTestPlayer({ positions: ['PG'], heightInches: 72 }))).toBe(false)
    expect(isSpecialist(makeTestPlayer({ positions: ['C'], heightInches: 88 }))).toBe(false)
  })

  it('measures spread against the position, so a PG built like a PG is not a Specialist', () => {
    // POSITION_BIAS rolls a point guard at +15 ballHandling and -15 rebounding. This profile is that
    // shape and nothing more -- 30 points of raw spread, 0 once the bias is subtracted back out.
    const player = makeTestPlayer({
      positions: ['PG'],
      heightInches: 74,
      attributes: {
        ballHandling: 65,
        passing: 65,
        speed: 60,
        lateralQuickness: 60,
        outsideShot: 55,
        insideShot: 40,
        interiorDefense: 35,
        rebounding: 35,
      },
    })
    expect(attributeSpread(player)).toBe(30)
    expect(positionRelativeSpread(player)).toBe(0)
    expect(isSpecialist(player)).toBe(false)
  })

  it('still flags a spike that survives subtracting the position bias', () => {
    // Same PG, but the outside shot is a genuine outlier rather than part of the position's shape.
    const player = makeTestPlayer({
      positions: ['PG'],
      heightInches: 74,
      attributes: {
        ballHandling: 65,
        passing: 65,
        speed: 60,
        lateralQuickness: 60,
        outsideShot: 100,
        insideShot: 40,
        interiorDefense: 35,
        rebounding: 35,
      },
    })
    // Every residual lands on 50 except the outside shot, which lands on 95.
    expect(positionRelativeSpread(player)).toBe(45)
    expect(isSpecialist(player)).toBe(true)
  })

  it('flags a sharply spiked attribute profile as Specialist even at a comfortable height', () => {
    const player = makeTestPlayer({ positions: ['SF'], heightInches: 79, attributes: { insideShot: 95, passing: 30 } })
    expect(isSpecialist(player)).toBe(true)
  })

  it('calls a comfortable, single-band, flat-profile player neither', () => {
    const player = makeTestPlayer({ positions: ['SF'], heightInches: 79 })
    expect(isPositionless(player)).toBe(false)
    expect(isSpecialist(player)).toBe(false)
  })
})

describe('quirk distribution across generated leagues', () => {
  // The real specification for the two thresholds. Both quirks modify the out-of-position penalty,
  // and the penalty constants were reasoned around the *neutral* player -- so if a label stops being
  // uncommon, the case those constants describe stops being the common one. Before this was
  // measured, 76% of point guards and 58% of centers read as Specialist and neutral was the rarest
  // outcome at every position but center, because the raw attribute spread was mostly re-reading
  // POSITION_BIAS. Asserted rather than eyeballed so it fails if generation or a threshold drifts.
  const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
  const SEEDS = [1, 2, 3, 4, 5]

  const players: Player[] = SEEDS.flatMap(
    (seed) => generateLeague({ teamCount: 8, leagueName: `L${seed}`, rng: createSeededRng(seed) }).players,
  )

  const tally = (position: Position) => {
    const group = players.filter((player) => player.positions[0] === position)
    const positionless = group.filter(isPositionless).length
    const specialist = group.filter(isSpecialist).length
    return {
      count: group.length,
      positionless: positionless / group.length,
      specialist: specialist / group.length,
      neutral: (group.length - positionless - specialist) / group.length,
    }
  }

  it('samples enough players at every position to say anything', () => {
    POSITIONS.forEach((position) => expect(tally(position).count).toBeGreaterThan(50))
  })

  it('leaves neutral the most common outcome at every position', () => {
    POSITIONS.forEach((position) => {
      const share = tally(position)
      expect(share.neutral).toBeGreaterThan(share.positionless)
      expect(share.neutral).toBeGreaterThan(share.specialist)
      expect(share.neutral).toBeGreaterThan(0.5)
    })
  })

  it('keeps both labels uncommon at every position', () => {
    POSITIONS.forEach((position) => {
      const share = tally(position)
      expect(share.positionless).toBeLessThan(0.28)
      expect(share.specialist).toBeLessThan(0.28)
    })
  })

  it('still hands both labels out at every position -- neither is dead', () => {
    POSITIONS.forEach((position) => {
      const share = tally(position)
      expect(share.positionless).toBeGreaterThan(0.02)
      expect(share.specialist).toBeGreaterThan(0.1)
    })
  })
})

describe('positionFitSeverityMultiplier', () => {
  it('is 1 for a player with neither quirk', () => {
    expect(positionFitSeverityMultiplier(makeTestPlayer({ positions: ['SF'], heightInches: 79 }))).toBe(1)
  })

  it('discounts severity for a Positionless player', () => {
    expect(positionFitSeverityMultiplier(makeTestPlayer({ positions: ['SF'], heightInches: 81 }))).toBe(0.5)
  })

  it('surcharges severity for a Specialist', () => {
    const spiked = makeTestPlayer({
      positions: ['SF'],
      heightInches: 79,
      attributes: { insideShot: 95, passing: 30 },
    })
    expect(positionFitSeverityMultiplier(spiked)).toBe(1.5)
  })
})

describe('effectivePlayer', () => {
  it('is a no-op -- returns the same reference -- when the slot matches the player\'s own position', () => {
    const player = makeTestPlayer({ positions: ['PG'] })
    expect(effectivePlayer(player, 'PG')).toBe(player)
  })

  it('docks only the attributes the new slot leans on, leaving the rest untouched', () => {
    // Neutral (no quirk) SF slid to C: full interior demand weight, zero perimeter demand weight.
    // slide 2 slots * 6 + height misfit 3" * 3 = 21 points off every interior attribute.
    const player = makeTestPlayer({ positions: ['SF'], heightInches: 79 })
    const effective = effectivePlayer(player, 'C')

    expect(effective.attributes.insideShot).toBe(29)
    expect(effective.attributes.rebounding).toBe(29)
    expect(effective.attributes.interiorDefense).toBe(29)
    expect(effective.attributes.vertical).toBe(29)
    // Passing and the rest of the perimeter attributes are exactly what C leans on least.
    expect(effective.attributes.passing).toBe(50)
    expect(effective.attributes.ballHandling).toBe(50)
    expect(effective.attributes.outsideShot).toBe(50)
    expect(effective.attributes.perimeterDefense).toBe(50)
    expect(effective.attributes.speed).toBe(50)
    expect(effective.attributes.lateralQuickness).toBe(50)
  })

  it('splits the dock fractionally for a partial-lean slot instead of all-or-nothing', () => {
    // Neutral SF slid one slot to PF (lean 0.75): slide 1*6 + height misfit 1"*3 = 9 severity.
    const player = makeTestPlayer({ positions: ['SF'], heightInches: 79 })
    const effective = effectivePlayer(player, 'PF')

    expect(effective.attributes.rebounding).toBeCloseTo(50 - 9 * 0.75, 5)
    expect(effective.attributes.passing).toBeCloseTo(50 - 9 * 0.25, 5)
  })

  it('clamps at 0 rather than going negative on an extreme mismatch', () => {
    // Neutral center (single-band, comfortably off C's own edges) slid all the way to PG: slide
    // 4*6 + height misfit 9"*3 = 51 severity, docked fully onto every perimeter attribute.
    const player = makeTestPlayer({ positions: ['C'], heightInches: 85 })
    expect(positionFitSeverityMultiplier(player)).toBe(1) // sanity: this case is meant to be quirk-neutral
    const effective = effectivePlayer(player, 'PG')

    expect(effective.attributes.ballHandling).toBe(0)
    expect(effective.attributes.passing).toBe(0)
    // Interior attributes are what a center leans on, not what a point guard slot demands, so they
    // survive the slide untouched.
    expect(effective.attributes.rebounding).toBe(50)
    expect(effective.attributes.interiorDefense).toBe(50)
  })

  it('scales the same slide down for a Positionless player and up for a Specialist', () => {
    // SF -> PF is a 1-slot slide either way, but the two heights land in different bands, so each
    // has its own base severity before the multiplier: 81" is already inside PF's band (0" misfit),
    // 79" is 1" short of it.
    const flat = makeTestPlayer({ positions: ['SF'], heightInches: 81, attributes: { rebounding: 50 } }) // Positionless
    const spiked = makeTestPlayer({
      positions: ['SF'],
      heightInches: 79,
      attributes: { rebounding: 50, insideShot: 95, passing: 30 },
    }) // Specialist

    expect(effectivePlayer(flat, 'PF').attributes.rebounding).toBeCloseTo(50 - 6 * 0.5 * 0.75, 5) // 0" height misfit
    expect(effectivePlayer(spiked, 'PF').attributes.rebounding).toBeCloseTo(50 - (6 * 1 + 3 * 1) * 1.5 * 0.75, 5)
  })

  it('never touches overallRating', () => {
    const player = makeTestPlayer({ positions: ['SF'], heightInches: 79 })
    player.overallRating = 12345 // decoy -- must survive unread and unchanged
    expect(effectivePlayer(player, 'C').overallRating).toBe(12345)
  })
})

describe('effectiveFive', () => {
  it('maps effectivePlayer across a whole five, preserving each slot', () => {
    const guard = makeTestPlayer({ positions: ['PG'], heightInches: 72 })
    const center = makeTestPlayer({ positions: ['C'], heightInches: 85 })
    const five = [
      { player: guard, slot: 'PG' as const },
      { player: center, slot: 'PG' as const }, // charted out of position on purpose
    ]

    const effective = effectiveFive(five)

    expect(effective[0].slot).toBe('PG')
    expect(effective[0].player).toBe(guard) // native slot, untouched reference
    expect(effective[1].slot).toBe('PG')
    expect(effective[1].player).not.toBe(center) // out of position, attribute-shifted copy
    expect(effective[1].player.id).toBe(center.id)
  })
})
