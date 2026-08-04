import type { Game, League, Player, Team } from '../types'
import type { RunState } from '../../run/types'
import { localStorageAdapter } from './localStorageAdapter'
import type { StorageAdapter } from './storageAdapter'

const RUN_KEY = 'hotseat:run'

export interface RunBundle {
  run: RunState
  league: League
  teams: Team[]
  players: Player[]
  games: Game[]
  /** Whether the season just played hit the run's target -- display-only, saved rather than
   *  re-derived so the results screen doesn't need to infer it from run-state-machine internals. */
  lastSeasonTargetHit: boolean
}

function isValidBundleShape(data: unknown): data is RunBundle {
  if (!data || typeof data !== 'object') return false
  const b = data as Record<string, unknown>
  return !!b.run && typeof b.run === 'object' && !!b.league && typeof b.league === 'object' && Array.isArray(b.teams) && Array.isArray(b.players)
}

/**
 * Single-key JSON blob, unlike Hoop Sim's League save (4 keys + schema version for granular
 * read/write on a large, long-lived franchise). A run's whole state is small and short-lived, so
 * that granularity isn't worth the complexity -- no migration system yet either, for the same
 * reason: nothing has shipped to migrate away from.
 */
export async function saveRunBundle(bundle: RunBundle, adapter: StorageAdapter = localStorageAdapter): Promise<void> {
  await adapter.setItem(RUN_KEY, JSON.stringify(bundle))
}

export async function loadRunBundle(adapter: StorageAdapter = localStorageAdapter): Promise<RunBundle | null> {
  const raw = await adapter.getItem(RUN_KEY)
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isValidBundleShape(parsed)) throw new Error('Saved run does not match the expected shape')
    return parsed
  } catch (err) {
    console.warn('Failed to load saved run -- starting fresh.', err)
    return null
  }
}

export async function clearRunBundle(adapter: StorageAdapter = localStorageAdapter): Promise<void> {
  await adapter.removeItem(RUN_KEY)
}
