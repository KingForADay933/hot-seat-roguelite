import { describe, expect, it } from 'vitest'
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

  it('flags a height at the extreme low edge of a single-band position as Specialist', () => {
    // PG's own band is 72-76"; 72" is the floor and doesn't reach into SG's band at all.
    const player = makeTestPlayer({ positions: ['PG'], heightInches: 72 })
    expect(isPositionless(player)).toBe(false)
    expect(isSpecialist(player)).toBe(true)
  })

  it('flags a height at the extreme high edge the same way', () => {
    // C's own band is 82-88"; 88" is the ceiling and doesn't reach into PF's band.
    const player = makeTestPlayer({ positions: ['C'], heightInches: 88 })
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

describe('positionFitSeverityMultiplier', () => {
  it('is 1 for a player with neither quirk', () => {
    expect(positionFitSeverityMultiplier(makeTestPlayer({ positions: ['SF'], heightInches: 79 }))).toBe(1)
  })

  it('discounts severity for a Positionless player', () => {
    expect(positionFitSeverityMultiplier(makeTestPlayer({ positions: ['SF'], heightInches: 81 }))).toBe(0.5)
  })

  it('surcharges severity for a Specialist', () => {
    expect(positionFitSeverityMultiplier(makeTestPlayer({ positions: ['PG'], heightInches: 72 }))).toBe(1.5)
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
