/** Bump this whenever League/Team/Player/Game's persisted shape changes in a breaking way. */
export const CURRENT_SCHEMA_VERSION = 1

type Migration = (bundle: unknown) => unknown

/**
 * Keyed by the version a migration upgrades FROM. Starts empty -- version 1 is where this
 * versioning system begins, so there's nothing to migrate from yet.
 *
 * To add one when the next schema change ships: bump CURRENT_SCHEMA_VERSION above, then add
 * MIGRATIONS[oldVersion] = (bundle) => { ...transform the old shape into the new one... }.
 */
export const MIGRATIONS: Record<number, Migration> = {}

/** Pure. Applies each registered migration in sequence from fromVersion up to toVersion. */
export function applyMigrations(
  bundle: unknown,
  fromVersion: number,
  toVersion: number,
  migrations: Record<number, Migration>,
): unknown {
  let result = bundle
  for (let v = fromVersion; v < toVersion; v++) {
    const migrate = migrations[v]
    if (!migrate) throw new Error(`Missing migration from schema version ${v}`)
    result = migrate(result)
  }
  return result
}
