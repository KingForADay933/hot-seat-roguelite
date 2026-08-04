import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../rng'
import { generateTeam } from './randomTeam'

function team(seed: number) {
  return generateTeam({
    name: 'Test Team',
    city: 'Testville',
    abbreviation: 'TST',
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    offensiveStrategyId: 'motion',
    defensiveStrategyId: 'manToMan',
    rng: createSeededRng(seed),
  })
}

describe('generateTeam', () => {
  it('builds a 12-player roster', () => {
    const { players } = team(1)
    expect(players).toHaveLength(12)
  })

  it('produces a starting five with exactly one player per position', () => {
    const { team: t, players } = team(2)
    expect(t.startingFive).toHaveLength(5)
    const positions = t.startingFive.map((id) => players.find((p) => p.id === id)!.positions[0])
    expect(new Set(positions)).toEqual(new Set(['PG', 'SG', 'SF', 'PF', 'C']))
  })

  it('assigns every roster player to the team id', () => {
    const { team: t, players } = team(3)
    expect(players.every((p) => p.teamId === t.id)).toBe(true)
    expect(t.rosterPlayerIds.sort()).toEqual(players.map((p) => p.id).sort())
  })

  it('is reproducible for a given seed', () => {
    const a = team(42)
    const b = team(42)
    expect(a.players.map((p) => p.name)).toEqual(b.players.map((p) => p.name))
  })

  it('gives every rostered player a rotationMinutes entry within [0, 48]', () => {
    const { team: t, players } = team(4)
    players.forEach((p) => {
      expect(t.rotationMinutes[p.id]).toBeGreaterThanOrEqual(0)
      expect(t.rotationMinutes[p.id]).toBeLessThanOrEqual(48)
    })
  })

  it('sums each position group\'s rotationMinutes to approximately 48', () => {
    const { team: t, players } = team(5)
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const
    positions.forEach((position) => {
      const group = players.filter((p) => p.positions[0] === position)
      const sum = group.reduce((total, p) => total + t.rotationMinutes[p.id], 0)
      expect(sum).toBeCloseTo(48, 5)
    })
  })

  it('gives higher-rated players within a position group a larger rotationMinutes share', () => {
    const { team: t, players } = team(6)
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const
    positions.forEach((position) => {
      const group = [...players.filter((p) => p.positions[0] === position)].sort(
        (a, b) => b.overallRating - a.overallRating,
      )
      for (let i = 1; i < group.length; i++) {
        expect(t.rotationMinutes[group[i - 1].id]).toBeGreaterThanOrEqual(t.rotationMinutes[group[i].id])
      }
    })
  })

  it('gives the starter the largest rotationMinutes share at their position', () => {
    const { team: t, players } = team(7)
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const
    positions.forEach((position) => {
      const group = players.filter((p) => p.positions[0] === position)
      const starterId = t.startingFive.find((id) => group.some((p) => p.id === id))
      if (!starterId) return
      const maxShare = Math.max(...group.map((p) => t.rotationMinutes[p.id]))
      expect(t.rotationMinutes[starterId]).toBeCloseTo(maxShare, 5)
    })
  })
})
