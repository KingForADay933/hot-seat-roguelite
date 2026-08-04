import { describe, expect, it } from 'vitest'
import type { PlayerAttributes, Position } from '../../data/types'
import { ATTRIBUTE_CEILING, ATTRIBUTE_FLOOR } from '../constants'
import { createSeededRng } from '../rng'
import { generatePlayer } from './randomPlayer'

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

describe('generatePlayer', () => {
  it('keeps every attribute within the documented 40-99 (2K-style) range across many seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = createSeededRng(seed)
      const position = POSITIONS[seed % POSITIONS.length]
      const player = generatePlayer(position, rng)
      for (const value of Object.values(player.attributes)) {
        expect(value).toBeGreaterThanOrEqual(ATTRIBUTE_FLOOR)
        expect(value).toBeLessThanOrEqual(ATTRIBUTE_CEILING)
      }
    }
  })

  it('centers the unbiased baseline roll around ~70 ("decent" NBA level) across many trials', () => {
    const trials = 300
    let total = 0
    for (let seed = 0; seed < trials; seed++) {
      // SF has an empty POSITION_BIAS entry, so this isolates the baseline curve from bias.
      const player = generatePlayer('SF', createSeededRng(seed))
      total += Object.values(player.attributes).reduce((a, b) => a + b, 0) / 10
    }
    const mean = total / trials
    expect(mean).toBeGreaterThan(65)
    expect(mean).toBeLessThan(75)
  })

  it('assigns the requested position and a plausible height for it', () => {
    const rng = createSeededRng(1)
    const center = generatePlayer('C', rng)
    expect(center.positions).toEqual(['C'])
    expect(center.heightInches).toBeGreaterThanOrEqual(82)
    expect(center.heightInches).toBeLessThanOrEqual(88)
  })

  it('centers roll higher interior defense/rebounding than point guards on average', () => {
    const trials = 30
    let centerTotal = 0
    let guardTotal = 0
    for (let seed = 0; seed < trials; seed++) {
      const center = generatePlayer('C', createSeededRng(seed * 2))
      const guard = generatePlayer('PG', createSeededRng(seed * 2 + 1))
      centerTotal += center.attributes.interiorDefense + center.attributes.rebounding
      guardTotal += guard.attributes.interiorDefense + guard.attributes.rebounding
    }
    expect(centerTotal / trials).toBeGreaterThan(guardTotal / trials)
  })

  it('produces hidden traits within their documented 40-90 range', () => {
    const rng = createSeededRng(7)
    const player = generatePlayer('SF', rng)
    expect(player.hidden.consistency).toBeGreaterThanOrEqual(40)
    expect(player.hidden.consistency).toBeLessThanOrEqual(90)
    expect(player.hidden.clutch).toBeGreaterThanOrEqual(40)
    expect(player.hidden.clutch).toBeLessThanOrEqual(90)
  })

  it('rolls a per-attribute potential within the documented 40-99 range for every attribute', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = createSeededRng(seed)
      const position = POSITIONS[seed % POSITIONS.length]
      const player = generatePlayer(position, rng)
      for (const value of Object.values(player.development.potential)) {
        expect(value).toBeGreaterThanOrEqual(40)
        expect(value).toBeLessThanOrEqual(99)
      }
    }
  })

  it('gives rising-stage players more potential headroom above their current attributes than peak/declining players, on average', () => {
    const trials = 40
    let risingHeadroom = 0
    let otherHeadroom = 0
    let risingCount = 0
    let otherCount = 0
    for (let seed = 0; seed < trials; seed++) {
      const rng = createSeededRng(seed * 3)
      const player = generatePlayer(POSITIONS[seed % POSITIONS.length], rng)
      const headroom =
        Object.keys(player.attributes).reduce(
          (sum, key) => sum + (player.development.potential[key as keyof typeof player.attributes] - player.attributes[key as keyof typeof player.attributes]),
          0,
        ) / 10
      if (player.development.ageCurveStage === 'rising') {
        risingHeadroom += headroom
        risingCount += 1
      } else {
        otherHeadroom += headroom
        otherCount += 1
      }
    }
    expect(risingCount).toBeGreaterThan(0)
    expect(otherCount).toBeGreaterThan(0)
    expect(risingHeadroom / risingCount).toBeGreaterThan(otherHeadroom / otherCount)
  })

  it('shifts average generated attributes up or down with the League Setup Average Overall slider, staying within the floor/ceiling', () => {
    const trials = 40
    let shiftedUpTotal = 0
    let neutralTotal = 0
    let shiftedDownTotal = 0

    for (let seed = 0; seed < trials; seed++) {
      const position = POSITIONS[seed % POSITIONS.length]
      const up = generatePlayer(position, createSeededRng(seed), 15)
      const neutral = generatePlayer(position, createSeededRng(seed), 0)
      const down = generatePlayer(position, createSeededRng(seed), -15)

      for (const value of [...Object.values(up.attributes), ...Object.values(down.attributes)]) {
        expect(value).toBeGreaterThanOrEqual(ATTRIBUTE_FLOOR)
        expect(value).toBeLessThanOrEqual(ATTRIBUTE_CEILING)
      }

      const average = (attrs: PlayerAttributes) => Object.values(attrs).reduce((a, b) => a + b, 0) / 10
      shiftedUpTotal += average(up.attributes)
      neutralTotal += average(neutral.attributes)
      shiftedDownTotal += average(down.attributes)
    }

    expect(shiftedUpTotal / trials).toBeGreaterThan(neutralTotal / trials)
    expect(neutralTotal / trials).toBeGreaterThan(shiftedDownTotal / trials)
  })
})
