import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../../engine/rng'
import { pickDistinct } from './draftPool'

describe('pickDistinct', () => {
  it('returns the requested count with no duplicates', () => {
    const pool = ['a', 'b', 'c', 'd', 'e']
    const rng = createSeededRng(1)
    const result = pickDistinct(pool, 3, rng)
    expect(result).toHaveLength(3)
    expect(new Set(result).size).toBe(3)
    for (const item of result) expect(pool).toContain(item)
  })

  it('returns all items when count equals pool size', () => {
    const pool = ['a', 'b', 'c']
    const result = pickDistinct(pool, 3, createSeededRng(2))
    expect(new Set(result)).toEqual(new Set(pool))
  })

  it('returns an empty array when count is 0', () => {
    expect(pickDistinct(['a', 'b'], 0, createSeededRng(3))).toEqual([])
  })

  it('throws when count exceeds pool size', () => {
    expect(() => pickDistinct(['a', 'b'], 3, createSeededRng(4))).toThrow()
  })

  it('varies its selection across different rng seeds', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const results = new Set<string>()
    for (let seed = 0; seed < 20; seed++) {
      results.add(pickDistinct(pool, 2, createSeededRng(seed)).join(','))
    }
    expect(results.size).toBeGreaterThan(1)
  })
})
