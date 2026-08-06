import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { indexedDbAdapter } from './indexedDbAdapter'

// fake-indexeddb/auto installs an in-memory IndexedDB on globalThis -- this codebase's only other
// storage adapter (the old localStorage one) needed no such polyfill, but IndexedDB doesn't exist
// in vitest's node environment otherwise.

beforeEach(async () => {
  await indexedDbAdapter.clear()
})

describe('indexedDbAdapter', () => {
  it('returns null for a key that was never set', async () => {
    expect(await indexedDbAdapter.getItem('missing')).toBeNull()
  })

  it('round-trips a stored value', async () => {
    await indexedDbAdapter.setItem('key', 'value')
    expect(await indexedDbAdapter.getItem('key')).toBe('value')
  })

  it('overwrites an existing value on a second setItem', async () => {
    await indexedDbAdapter.setItem('key', 'first')
    await indexedDbAdapter.setItem('key', 'second')
    expect(await indexedDbAdapter.getItem('key')).toBe('second')
  })

  it('removes a single key without touching others', async () => {
    await indexedDbAdapter.setItem('a', '1')
    await indexedDbAdapter.setItem('b', '2')
    await indexedDbAdapter.removeItem('a')
    expect(await indexedDbAdapter.getItem('a')).toBeNull()
    expect(await indexedDbAdapter.getItem('b')).toBe('2')
  })

  it('clears every key', async () => {
    await indexedDbAdapter.setItem('a', '1')
    await indexedDbAdapter.setItem('b', '2')
    await indexedDbAdapter.clear()
    expect(await indexedDbAdapter.getItem('a')).toBeNull()
    expect(await indexedDbAdapter.getItem('b')).toBeNull()
  })

  it("stores a payload well beyond the old localStorage adapter's ~5MB per-origin ceiling", async () => {
    const big = 'x'.repeat(8 * 1024 * 1024) // 8MB -- already over the wall that motivated this adapter
    await indexedDbAdapter.setItem('big', big)
    expect(await indexedDbAdapter.getItem('big')).toBe(big)
  })
})
