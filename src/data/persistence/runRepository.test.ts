import { describe, expect, it } from 'vitest'
import { createRun } from '../../run/runState'
import type { League } from '../types'
import { clearRunBundle, loadRunBundle, saveRunBundle, type RunBundle } from './runRepository'
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
    teamIds: ['team-1'],
    scheduleGameIds: [],
    rules: { seasonLength: 32, playoffFormat: null },
    pacePresets: { possessionsPerGame: 100 },
    currentDate: new Date().toISOString(),
    userControlledTeamId: 'team-1',
    seasonNumber: 1,
    seasonHistory: [],
  }
}

function makeTestBundle(): RunBundle {
  return {
    run: createRun('team-1', 'stacked-guards', 'youth-movement', 'mid'),
    league: makeTestLeague(),
    teams: [],
    players: [],
    games: [],
    lastSeasonTargetHit: false,
    lastWildcardEvent: null,
    lastBudgetEarned: 0,
    shop: null,
    lastChunkInsights: [],
    runInsights: [],
    stretchInProgress: false,
    pendingChunkInsights: [],
  }
}

describe('saveRunBundle / loadRunBundle', () => {
  it('round-trips a bundle unchanged', async () => {
    const adapter = makeMemoryAdapter()
    const bundle = makeTestBundle()
    await saveRunBundle(bundle, adapter)
    expect(await loadRunBundle(adapter)).toEqual(bundle)
  })

  it('returns null when no run is saved', async () => {
    const adapter = makeMemoryAdapter()
    expect(await loadRunBundle(adapter)).toBeNull()
  })

  it('returns null (not a throw) for malformed JSON', async () => {
    const adapter = makeMemoryAdapter()
    await adapter.setItem('hotseat:run', '{not valid json')
    expect(await loadRunBundle(adapter)).toBeNull()
  })

  it('returns null (not a throw) for a pre-variation-system save missing rosterQuirk/houseRule', async () => {
    const adapter = makeMemoryAdapter()
    const legacyBundle = makeTestBundle()
    const { rosterQuirk: _rosterQuirk, houseRule: _houseRule, ...legacyRun } = legacyBundle.run
    await adapter.setItem('hotseat:run', JSON.stringify({ ...legacyBundle, run: legacyRun }))
    expect(await loadRunBundle(adapter)).toBeNull()
  })

  it('returns null (not a throw) for a pre-market-size save missing marketSize', async () => {
    const adapter = makeMemoryAdapter()
    const legacyBundle = makeTestBundle()
    const { marketSize: _marketSize, ...legacyRun } = legacyBundle.run
    await adapter.setItem('hotseat:run', JSON.stringify({ ...legacyBundle, run: legacyRun }))
    expect(await loadRunBundle(adapter)).toBeNull()
  })

  it('returns null (not a throw) for a pre-coaching-upgrades save missing coachingUpgrades', async () => {
    const adapter = makeMemoryAdapter()
    const legacyBundle = makeTestBundle()
    const { coachingUpgrades: _coachingUpgrades, ...legacyRun } = legacyBundle.run
    await adapter.setItem('hotseat:run', JSON.stringify({ ...legacyBundle, run: legacyRun }))
    expect(await loadRunBundle(adapter)).toBeNull()
  })

  it('returns null (not a throw) for a pre-consumables save missing consumableInventory/activeConsumablesThisSeason', async () => {
    const adapter = makeMemoryAdapter()
    const legacyBundle = makeTestBundle()
    const { consumableInventory: _consumableInventory, activeConsumablesThisSeason: _activeConsumablesThisSeason, ...legacyRun } = legacyBundle.run
    await adapter.setItem('hotseat:run', JSON.stringify({ ...legacyBundle, run: legacyRun }))
    expect(await loadRunBundle(adapter)).toBeNull()
  })
})

describe('clearRunBundle', () => {
  it('removes the saved run', async () => {
    const adapter = makeMemoryAdapter()
    await saveRunBundle(makeTestBundle(), adapter)
    await clearRunBundle(adapter)
    expect(await loadRunBundle(adapter)).toBeNull()
  })
})
