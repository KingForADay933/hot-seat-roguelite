import { describe, expect, it } from 'vitest'
import { shiftPlayerAttributes } from './attributeShift'
import { ATTRIBUTE_CEILING, ATTRIBUTE_FLOOR } from './constants'
import { makeTestPlayer } from './testFixtures'

describe('shiftPlayerAttributes', () => {
  it('adds a positive shift to every attribute and recomputes overallRating', () => {
    const player = makeTestPlayer()
    const shifted = shiftPlayerAttributes(player, 5)
    for (const key of Object.keys(shifted.attributes) as (keyof typeof shifted.attributes)[]) {
      expect(shifted.attributes[key]).toBe(player.attributes[key] + 5)
    }
    expect(shifted.overallRating).toBeGreaterThan(player.overallRating)
  })

  it('applies a negative shift to every attribute', () => {
    const player = makeTestPlayer()
    const shifted = shiftPlayerAttributes(player, -5)
    for (const key of Object.keys(shifted.attributes) as (keyof typeof shifted.attributes)[]) {
      expect(shifted.attributes[key]).toBe(player.attributes[key] - 5)
    }
    expect(shifted.overallRating).toBeLessThan(player.overallRating)
  })

  it('clamps at ATTRIBUTE_CEILING rather than overshooting', () => {
    const player = makeTestPlayer({ attributes: { insideShot: 97 } })
    const shifted = shiftPlayerAttributes(player, 10)
    expect(shifted.attributes.insideShot).toBe(ATTRIBUTE_CEILING)
  })

  it('clamps at ATTRIBUTE_FLOOR rather than undershooting', () => {
    const player = makeTestPlayer({ attributes: { insideShot: 42 } })
    const shifted = shiftPlayerAttributes(player, -10)
    expect(shifted.attributes.insideShot).toBe(ATTRIBUTE_FLOOR)
  })

  it('does not mutate the original player', () => {
    const player = makeTestPlayer()
    const originalInsideShot = player.attributes.insideShot
    shiftPlayerAttributes(player, 5)
    expect(player.attributes.insideShot).toBe(originalInsideShot)
  })
})
