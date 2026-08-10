import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../rng'
import { generateLeague } from './randomLeague'
import { generateTeam } from './randomTeam'

describe('generateLeague', () => {
  it('generates the requested number of teams with unique ids and abbreviations', () => {
    const { league, teams } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng: createSeededRng(1) })
    expect(teams).toHaveLength(8)
    expect(league.teamIds).toEqual(teams.map((t) => t.id))
    expect(new Set(teams.map((t) => t.abbreviation)).size).toBe(8)
  })

  it('produces every player tagged with a valid teamId from the generated teams', () => {
    const { teams, players } = generateLeague({ teamCount: 6, leagueName: 'Test League', rng: createSeededRng(2) })
    const teamIds = new Set(teams.map((t) => t.id))
    expect(players.every((p) => p.teamId !== null && teamIds.has(p.teamId))).toBe(true)
    expect(players).toHaveLength(6 * 12)
  })

  it('rejects an out-of-range team count', () => {
    expect(() => generateLeague({ teamCount: 1, leagueName: 'x', rng: createSeededRng(1) })).toThrow()
    expect(() => generateLeague({ teamCount: 99, leagueName: 'x', rng: createSeededRng(1) })).toThrow()
  })

  it('assigns a valid offensive and defensive preset id to every team', () => {
    const { teams } = generateLeague({ teamCount: 10, leagueName: 'Test League', rng: createSeededRng(3) })
    for (const t of teams) {
      expect(t.offensiveStrategyId.length).toBeGreaterThan(0)
      expect(t.defensiveStrategyId.length).toBeGreaterThan(0)
    }
  })
})

describe('player names', () => {
  it('gives every player in the league a name nobody else has', () => {
    // 8 x 12 = 96 players. The pools hold 40 x 40 = 1600 combinations, so this is well inside what
    // the space can serve -- the point is that it is enforced, not merely likely.
    const { players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng: createSeededRng(3) })
    const names = players.map((p) => p.name)

    expect(new Set(names).size).toBe(names.length)
  })

  it('holds across several seeds, not just a lucky one', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng: createSeededRng(seed) })
      const names = players.map((p) => p.name)
      const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
      expect(duplicates, `seed ${seed} produced duplicate names: ${[...new Set(duplicates)].join(', ')}`).toEqual([])
    }
  })

  it('keeps a standalone team unique within itself without being handed a set', () => {
    const { players } = generateTeam({
      name: 'Test',
      city: 'Test',
      abbreviation: 'TST',
      primaryColor: '#000',
      secondaryColor: '#fff',
      offensiveStrategyId: 'balanced',
      defensiveStrategyId: 'manToMan',
      rng: createSeededRng(11),
    })
    const names = players.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
