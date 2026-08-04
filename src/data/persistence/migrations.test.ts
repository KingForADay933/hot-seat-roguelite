import { describe, expect, it } from 'vitest'
import { applyMigrations } from './migrations'

describe('applyMigrations', () => {
  it('is a no-op when fromVersion equals toVersion', () => {
    const bundle = { foo: 'bar' }
    const result = applyMigrations(bundle, 3, 3, {})
    expect(result).toBe(bundle)
  })

  it('applies a chain of migrations in order', () => {
    const migrations = {
      1: (b: unknown) => ({ ...(b as Record<string, unknown>), addedAtV1: true }),
      2: (b: unknown) => ({ ...(b as Record<string, unknown>), addedAtV2: true }),
    }
    const result = applyMigrations({ original: true }, 1, 3, migrations)
    expect(result).toEqual({ original: true, addedAtV1: true, addedAtV2: true })
  })

  it('throws when a migration is missing for an intermediate version in range', () => {
    const migrations = { 1: (b: unknown) => b } // no migration registered for version 2
    expect(() => applyMigrations({}, 1, 3, migrations)).toThrow(/version 2/)
  })
})
