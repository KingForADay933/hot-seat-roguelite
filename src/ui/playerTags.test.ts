import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../engine/testFixtures'
import { attributeExtremes, growthHeadroom, playerTags } from './playerTags'

describe('growthHeadroom', () => {
  it('sums the gap to potential across all ten attributes', () => {
    // makeTestPlayer defaults every attribute to 50 and every potential to 85.
    expect(growthHeadroom(makeTestPlayer())).toBe(350)
  })

  it('ignores attributes already at or above their potential rather than going negative', () => {
    const maxed = makeTestPlayer({ attributes: { insideShot: 95 } })
    // insideShot contributes 0 (not -10); the other nine still contribute 35 each.
    expect(growthHeadroom(maxed)).toBe(315)
  })
})

describe('attributeExtremes', () => {
  it('names the highest and lowest attribute by display label', () => {
    const player = makeTestPlayer({ attributes: { outsideShot: 91, rebounding: 22 } })
    const { best, worst } = attributeExtremes(player)
    expect(best).toEqual({ label: 'OUT', value: 91 })
    expect(worst).toEqual({ label: 'REB', value: 22 })
  })
})

describe('playerTags', () => {
  const labels = (player: Parameters<typeof playerTags>[0]) => playerTags(player).map((t) => t.label)

  it('flags a high-clutch, high-consistency, high-durability player positively', () => {
    const player = makeTestPlayer({ hidden: { clutch: 88, consistency: 85, durability: 90 } })
    expect(labels(player)).toEqual(expect.arrayContaining(['Ice in the Veins', 'Metronome', 'Iron Man']))
  })

  it('flags the same traits negatively at the low end', () => {
    const player = makeTestPlayer({ hidden: { clutch: 20, consistency: 30, durability: 35, morale: 25 } })
    expect(labels(player)).toEqual(expect.arrayContaining(['Shrinks Late', 'Streaky', 'Gasses Out', 'Discontent']))
  })

  it('emits no trait tag for mid-range hidden values -- only genuinely notable ones get named', () => {
    const player = makeTestPlayer({ hidden: { clutch: 55, consistency: 60, durability: 60, morale: 60, tendency: 'balanced' } })
    for (const label of ['Ice in the Veins', 'Shrinks Late', 'Metronome', 'Streaky', 'Iron Man', 'Gasses Out', 'Bought In', 'Discontent']) {
      expect(labels(player)).not.toContain(label)
    }
  })

  it('names the age curve stage and untapped growth room', () => {
    const rookie = makeTestPlayer({ age: 20, development: { ageCurveStage: 'rising' } })
    expect(labels(rookie)).toEqual(expect.arrayContaining(['Rising', 'Untapped']))
  })

  it('calls out a low-ceiling player as maxed out', () => {
    // What applyLowCeiling produces: potential pinned within a few points of current attributes.
    const potential = Object.fromEntries(Object.keys(makeTestPlayer().attributes).map((k) => [k, 52])) as Record<string, number>
    const capped = makeTestPlayer({ development: { potential: potential as never } })
    expect(labels(capped)).toContain('Maxed Out')
    expect(labels(capped)).not.toContain('Untapped')
  })

  it('reports shooting tendency without scoring it good or bad', () => {
    const gunner = makeTestPlayer({ hidden: { tendency: 'shoot-first' } })
    const tag = playerTags(gunner).find((t) => t.label === 'Shoot-First')
    expect(tag?.tone).toBe('neutral')
  })

  it('names a Positionless player from the same derivation the sim reads for the out-of-position penalty', () => {
    // 81" sits inside both SF's and PF's height bands, and the default attribute profile is flat.
    const swingman = makeTestPlayer({ positions: ['SF'], heightInches: 81 })
    expect(labels(swingman)).toContain('Positionless')
    expect(labels(swingman)).not.toContain('Specialist')
  })

  it('names a Specialist player instead when height or attributes are spiked for one slot', () => {
    const shortGuard = makeTestPlayer({ positions: ['PG'], heightInches: 72 })
    expect(labels(shortGuard)).toContain('Specialist')
    expect(labels(shortGuard)).not.toContain('Positionless')
  })
})
