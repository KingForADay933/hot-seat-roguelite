import { describe, expect, it } from 'vitest'
import { DEFENSIVE_SCHEMES } from '../../data/presets'
import { makeTestPlayer } from '../testFixtures'
import type { PlaySelection } from './playerSelector'
import { computeResistance } from './resistance'

const manToMan = DEFENSIVE_SCHEMES.manToMan
const packThePaint = DEFENSIVE_SCHEMES.packThePaint
const fullCourtPress = DEFENSIVE_SCHEMES.fullCourtPress

const neutralOnCourt = () => Array.from({ length: 5 }, () => makeTestPlayer()) // all default 50s -> zero press term

function selectionFor(overrides: Partial<PlaySelection>): PlaySelection {
  return {
    primary: makeTestPlayer(),
    secondaries: [],
    primaryDefender: makeTestPlayer(),
    secondaryDefenders: [],
    isOutsideShotAction: false,
    ...overrides,
  }
}

describe('computeResistance', () => {
  it('pick-and-roll: weights handler-defender lateral/perimeter and roller-defender interior, press term neutral at default attributes', () => {
    const handlerDef = makeTestPlayer({ attributes: { lateralQuickness: 60, perimeterDefense: 70 } })
    const rollerDef = makeTestPlayer({ attributes: { interiorDefense: 80 } })
    const selection = selectionFor({ primaryDefender: handlerDef, secondaryDefenders: [rollerDef] })

    const r = computeResistance('pick-and-roll', selection, manToMan, neutralOnCourt(), neutralOnCourt())
    // 0.4*60 + 0.3*70 + 0.3*80 = 69, press term = 0 since on-court arrays are all-default
    expect(r).toBeCloseTo(69, 5)
  })

  it('Pack-the-Paint boosts resistance on an interior action (Post-Up) relative to Man-to-Man', () => {
    const def = makeTestPlayer({ attributes: { interiorDefense: 70, vertical: 60 } })
    const selection = selectionFor({ primaryDefender: def, isOutsideShotAction: false })

    const manToManR = computeResistance('post-up', selection, manToMan, neutralOnCourt(), neutralOnCourt())
    const packR = computeResistance('post-up', selection, packThePaint, neutralOnCourt(), neutralOnCourt())

    expect(packR).toBeGreaterThan(manToManR)
  })

  it('Pack-the-Paint lowers resistance on a perimeter action (outside Isolation) relative to Man-to-Man', () => {
    const def = makeTestPlayer({ attributes: { lateralQuickness: 70, perimeterDefense: 60 } })
    const selection = selectionFor({ primaryDefender: def, isOutsideShotAction: true })

    const manToManR = computeResistance('isolation', selection, manToMan, neutralOnCourt(), neutralOnCourt())
    const packR = computeResistance('isolation', selection, packThePaint, neutralOnCourt(), neutralOnCourt())

    expect(packR).toBeLessThan(manToManR)
  })

  it('adds a positive backcourt-pressure term when the defense out-athletes the offense on the ball, scaled by pressureCoefficient', () => {
    const def = makeTestPlayer({ attributes: { perimeterDefense: 50 } })
    const selection = selectionFor({ primaryDefender: def, isOutsideShotAction: true })

    const weakHandlingOffense = Array.from({ length: 5 }, () =>
      makeTestPlayer({ attributes: { ballHandling: 30, passing: 30 } }),
    )
    const athleticDefense = neutralOnCourt() // speed/lateral average to 50

    const r = computeResistance('spot-up', selection, fullCourtPress, weakHandlingOffense, athleticDefense)
    // base: 50 * (1 + (0.3-0.5)*-1) = 50*1.2 = 60; press: 1.3*(50-30)*0.15 = 3.9; total 63.9
    expect(r).toBeCloseTo(63.9, 5)
  })
})
