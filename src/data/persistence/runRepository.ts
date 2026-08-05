import type { Game, League, Player, Team } from '../types'
import type { ShopVisit } from '../../run/shop'
import type { RunState } from '../../run/types'
import type { WildcardEventOutcome } from '../../run/variation/wildcardEvents'
import { indexedDbAdapter } from './indexedDbAdapter'
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
  /** The wildcard event (if any) rolled during the season just played -- display-only, same reason. */
  lastWildcardEvent: WildcardEventOutcome | null
  /** Budget earned during the season just played (not the running total, which lives on
   *  run.budget) -- display-only, same reason as the two fields above. */
  lastBudgetEarned: number
  /** Section 8.5's Shop: null while between shop visits (e.g. right after a season sims, before
   *  the results recap has been continued past); non-null while a visit is in progress, holding
   *  the current offer list and remaining rerolls so a refresh mid-shop doesn't lose progress. */
  shop: ShopVisit | null
}

function isValidBundleShape(data: unknown): data is RunBundle {
  if (!data || typeof data !== 'object') return false
  const b = data as Record<string, unknown>
  if (!b.run || typeof b.run !== 'object' || !b.league || typeof b.league !== 'object') return false
  if (!Array.isArray(b.teams) || !Array.isArray(b.players) || !Array.isArray(b.games)) return false

  // run.rosterQuirk/houseRule/marketSize were added across Phases 3-5 -- reject (rather than
  // silently accept and crash a screen reading them later) a save from before any of them existed.
  const run = b.run as Record<string, unknown>
  return typeof run.rosterQuirk === 'string' && typeof run.houseRule === 'string' && typeof run.marketSize === 'string'
}

/**
 * Single-key JSON blob, unlike Hoop Sim's League save (4 keys + schema version for granular
 * read/write on a large, long-lived franchise). A run's whole state is small and short-lived, so
 * that granularity isn't worth the complexity -- no migration system yet either, for the same
 * reason: nothing has shipped to migrate away from.
 */
export async function saveRunBundle(bundle: RunBundle, adapter: StorageAdapter = indexedDbAdapter): Promise<void> {
  await adapter.setItem(RUN_KEY, JSON.stringify(bundle))
}

export async function loadRunBundle(adapter: StorageAdapter = indexedDbAdapter): Promise<RunBundle | null> {
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

export async function clearRunBundle(adapter: StorageAdapter = indexedDbAdapter): Promise<void> {
  await adapter.removeItem(RUN_KEY)
}
