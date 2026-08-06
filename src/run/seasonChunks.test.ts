import { describe, expect, it } from 'vitest'
import { seasonChunkBoundaries } from './seasonChunks'

describe('seasonChunkBoundaries', () => {
  it('splits an evenly-divisible game count into equal contiguous ranges', () => {
    expect(seasonChunkBoundaries(32, 4)).toEqual([
      { start: 0, end: 8 },
      { start: 8, end: 16 },
      { start: 16, end: 24 },
      { start: 24, end: 32 },
    ])
  })

  it('front-loads the remainder when the game count does not divide evenly', () => {
    expect(seasonChunkBoundaries(33, 4)).toEqual([
      { start: 0, end: 9 },
      { start: 9, end: 17 },
      { start: 17, end: 25 },
      { start: 25, end: 33 },
    ])
  })

  it('covers every game exactly once, in order, with no gaps or overlaps', () => {
    const ranges = seasonChunkBoundaries(37, 4)
    expect(ranges[0].start).toBe(0)
    expect(ranges[ranges.length - 1].end).toBe(37)
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].start).toBe(ranges[i - 1].end)
    }
  })

  it('handles a single chunk as the whole season', () => {
    expect(seasonChunkBoundaries(32, 1)).toEqual([{ start: 0, end: 32 }])
  })
})
