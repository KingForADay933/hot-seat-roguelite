import { describe, expect, it } from 'vitest'
import { FATIGUE_PENALTY_FULL_AT, FATIGUE_PENALTY_THRESHOLD } from './constants'
import { effectiveFive } from './onCourtEffects'
import { makeTestPlayer } from './testFixtures'

describe('effectiveFive', () => {
  it('maps the position-fit shift across a whole five, preserving each slot', () => {
    const guard = makeTestPlayer({ positions: ['PG'], heightInches: 72 })
    const center = makeTestPlayer({ positions: ['C'], heightInches: 85 })
    const five = [
      { player: guard, slot: 'PG' as const },
      { player: center, slot: 'PG' as const }, // charted out of position on purpose
    ]

    const effective = effectiveFive(five)

    expect(effective[0].slot).toBe('PG')
    expect(effective[0].player).toBe(guard) // native slot and no fatigue, untouched reference
    expect(effective[1].slot).toBe('PG')
    expect(effective[1].player).not.toBe(center) // out of position, attribute-shifted copy
    expect(effective[1].player.id).toBe(center.id)
  })

  it('leaves a rested player alone even with a fatigue map in hand', () => {
    // The common case, and the one that has to allocate nothing: most players on most possessions
    // sit below the threshold.
    const player = makeTestPlayer({ positions: ['PG'] })
    const five = [{ player, slot: 'PG' as const }]
    expect(effectiveFive(five, new Map([[player.id, FATIGUE_PENALTY_THRESHOLD]]))[0].player).toBe(player)
  })

  it('docks a tired player even in his own slot', () => {
    // Fatigue is the first shift that applies to a player who is exactly where he belongs, so this
    // is the case the position-fit early return would have swallowed if the two were not composed.
    const player = makeTestPlayer({ positions: ['PG'], attributes: { outsideShot: 80 } })
    const five = [{ player, slot: 'PG' as const }]
    const tired = effectiveFive(five, new Map([[player.id, FATIGUE_PENALTY_FULL_AT]]))[0].player

    expect(tired).not.toBe(player)
    expect(tired.attributes.outsideShot).toBeLessThan(80)
  })

  it('composes both shifts rather than letting one win', () => {
    // Out of position *and* exhausted should cost more than either alone -- the whole reason this
    // function exists rather than each effect having its own pass over the five.
    const player = makeTestPlayer({ positions: ['PG'], heightInches: 72, attributes: { speed: 80 } })
    const five = [{ player, slot: 'SF' as const }]
    const outOfPositionOnly = effectiveFive(five)[0].player
    const both = effectiveFive(five, new Map([[player.id, FATIGUE_PENALTY_FULL_AT]]))[0].player

    expect(outOfPositionOnly.attributes.speed).toBeLessThan(80)
    expect(both.attributes.speed).toBeLessThan(outOfPositionOnly.attributes.speed)
  })

  it('never mutates the player it was handed', () => {
    const player = makeTestPlayer({ positions: ['PG'], attributes: { outsideShot: 80 } })
    effectiveFive([{ player, slot: 'PG' as const }], new Map([[player.id, 100]]))
    expect(player.attributes.outsideShot).toBe(80)
  })
})
