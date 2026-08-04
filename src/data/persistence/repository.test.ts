import { describe, expect, it } from 'vitest'
import type { League } from '../types'
import { clearLeagueBundle, loadLeagueBundle, saveLeagueBundle, type LeagueBundle } from './repository'
import type { StorageAdapter } from './storageAdapter'

function makeMemoryAdapter(): StorageAdapter {
  const store = new Map<string, string>()
  return {
    async getItem(key) {
      return store.get(key) ?? null
    },
    async setItem(key, value) {
      store.set(key, value)
    },
    async removeItem(key) {
      store.delete(key)
    },
    async clear() {
      store.clear()
    },
  }
}

function makeTestLeague(): League {
  return {
    id: 'league-1',
    name: 'Test League',
    structure: 'single-conference',
    teamIds: [],
    scheduleGameIds: [],
    rules: { seasonLength: 16, playoffFormat: null },
    pacePresets: { possessionsPerGame: 100 },
    currentDate: new Date().toISOString(),
    userControlledTeamId: null,
    seasonNumber: 1,
    seasonHistory: [],
  }
}

function makeTestBundle(): LeagueBundle {
  return { league: makeTestLeague(), teams: [], players: [], games: [] }
}

describe('saveLeagueBundle / loadLeagueBundle', () => {
  it('round-trips a bundle unchanged', async () => {
    const adapter = makeMemoryAdapter()
    const bundle = makeTestBundle()
    await saveLeagueBundle(bundle, adapter)
    const loaded = await loadLeagueBundle(adapter)
    expect(loaded).toEqual(bundle)
  })

  it('writes CURRENT_SCHEMA_VERSION to the version key on save', async () => {
    const adapter = makeMemoryAdapter()
    await saveLeagueBundle(makeTestBundle(), adapter)
    expect(await adapter.getItem('hotseat:schemaVersion')).toBe('1')
  })

  it('returns null when no data exists at all', async () => {
    const adapter = makeMemoryAdapter()
    expect(await loadLeagueBundle(adapter)).toBeNull()
  })

  it('returns null (not a throw) for a legacy save with no schema version key', async () => {
    const adapter = makeMemoryAdapter()
    const bundle = makeTestBundle()
    await saveLeagueBundle(bundle, adapter)
    await adapter.removeItem('hotseat:schemaVersion') // simulate a save from before versioning existed

    const loaded = await loadLeagueBundle(adapter)
    expect(loaded).toBeNull()
  })

  it('returns null (not a throw) when a stored key is malformed JSON', async () => {
    const adapter = makeMemoryAdapter()
    await saveLeagueBundle(makeTestBundle(), adapter)
    await adapter.setItem('hotseat:teams', '{not valid json')

    const loaded = await loadLeagueBundle(adapter)
    expect(loaded).toBeNull()
  })
})

describe('clearLeagueBundle', () => {
  it('removes the schema version key along with the other four', async () => {
    const adapter = makeMemoryAdapter()
    await saveLeagueBundle(makeTestBundle(), adapter)
    await clearLeagueBundle(adapter)

    expect(await adapter.getItem('hotseat:league')).toBeNull()
    expect(await adapter.getItem('hotseat:teams')).toBeNull()
    expect(await adapter.getItem('hotseat:players')).toBeNull()
    expect(await adapter.getItem('hotseat:games')).toBeNull()
    expect(await adapter.getItem('hotseat:schemaVersion')).toBeNull()
  })
})
