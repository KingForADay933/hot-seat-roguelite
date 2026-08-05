import type { Game, League, Player, Team } from '../types'
import { indexedDbAdapter } from './indexedDbAdapter'
import { applyMigrations, CURRENT_SCHEMA_VERSION, MIGRATIONS } from './migrations'
import type { StorageAdapter } from './storageAdapter'

const LEAGUE_KEY = 'hotseat:league'
const TEAMS_KEY = 'hotseat:teams'
const PLAYERS_KEY = 'hotseat:players'
const GAMES_KEY = 'hotseat:games'
const SCHEMA_VERSION_KEY = 'hotseat:schemaVersion'

export interface LeagueBundle {
  league: League
  teams: Team[]
  players: Player[]
  games: Game[]
}

function isValidBundleShape(data: unknown): data is LeagueBundle {
  if (!data || typeof data !== 'object') return false
  const b = data as Record<string, unknown>
  return (
    !!b.league &&
    typeof b.league === 'object' &&
    typeof (b.league as Record<string, unknown>).id === 'string' &&
    Array.isArray(b.teams) &&
    Array.isArray(b.players) &&
    Array.isArray(b.games)
  )
}

/** Stored as 4 separate keys rather than one blob, keeping individual reads/writes smaller,
 *  plus a 5th key tagging the schema version everything was saved at (see ./migrations.ts). */
export async function saveLeagueBundle(
  bundle: LeagueBundle,
  adapter: StorageAdapter = indexedDbAdapter,
): Promise<void> {
  await Promise.all([
    adapter.setItem(LEAGUE_KEY, JSON.stringify(bundle.league)),
    adapter.setItem(TEAMS_KEY, JSON.stringify(bundle.teams)),
    adapter.setItem(PLAYERS_KEY, JSON.stringify(bundle.players)),
    adapter.setItem(GAMES_KEY, JSON.stringify(bundle.games)),
    adapter.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION)),
  ])
}

/**
 * Loads the saved bundle, migrating it forward if it was saved at an older schema version.
 * Any failure along the way (missing version tag from before this system existed, corrupted
 * JSON, a migration chain that can't reach the current version, or a result that still doesn't
 * look like a valid bundle) is treated as "no usable save" rather than allowed to throw --
 * matching the existing behavior for when no save exists at all, just now also covering saves
 * that exist but can't be safely loaded.
 */
export async function loadLeagueBundle(adapter: StorageAdapter = indexedDbAdapter): Promise<LeagueBundle | null> {
  const [leagueRaw, teamsRaw, playersRaw, gamesRaw, versionRaw] = await Promise.all([
    adapter.getItem(LEAGUE_KEY),
    adapter.getItem(TEAMS_KEY),
    adapter.getItem(PLAYERS_KEY),
    adapter.getItem(GAMES_KEY),
    adapter.getItem(SCHEMA_VERSION_KEY),
  ])
  if (!leagueRaw || !teamsRaw || !playersRaw || !gamesRaw) return null

  try {
    let bundle: unknown = {
      league: JSON.parse(leagueRaw),
      teams: JSON.parse(teamsRaw),
      players: JSON.parse(playersRaw),
      games: JSON.parse(gamesRaw),
    }

    if (versionRaw === null) {
      throw new Error('Save has no schema version -- predates the migration system, cannot be safely loaded')
    }
    const storedVersion = Number(versionRaw)

    if (storedVersion !== CURRENT_SCHEMA_VERSION) {
      bundle = applyMigrations(bundle, storedVersion, CURRENT_SCHEMA_VERSION, MIGRATIONS)
    }

    if (!isValidBundleShape(bundle)) {
      throw new Error('Loaded save does not match the expected shape after migration')
    }

    if (storedVersion !== CURRENT_SCHEMA_VERSION) {
      await saveLeagueBundle(bundle, adapter) // persist the migrated shape so future loads skip re-migrating
    }

    return bundle
  } catch (err) {
    console.warn('Failed to load saved league (possibly from an incompatible older version) -- starting fresh.', err)
    return null
  }
}

export async function clearLeagueBundle(adapter: StorageAdapter = indexedDbAdapter): Promise<void> {
  await Promise.all([
    adapter.removeItem(LEAGUE_KEY),
    adapter.removeItem(TEAMS_KEY),
    adapter.removeItem(PLAYERS_KEY),
    adapter.removeItem(GAMES_KEY),
    adapter.removeItem(SCHEMA_VERSION_KEY),
  ])
}
