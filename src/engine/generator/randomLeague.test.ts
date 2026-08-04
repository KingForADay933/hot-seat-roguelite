import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../rng'
import { generateLeague } from './randomLeague'

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
