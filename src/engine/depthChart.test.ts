import { describe, expect, it } from 'vitest'
import type { Player } from '../data/types'
import { deriveDepthChart } from './depthChart'
import { generateLeague } from './generator/randomLeague'
import { createSeededRng } from './rng'

/**
 * Who starts and who plays how long, derived from a roster rather than fixed at generation.
 *
 * The interaction that made this worth extracting -- a roster quirk moving attributes underneath a
 * lineup nobody recomputed -- is exercised in run/variation/depthChartAfterQuirk.test.ts, since the
 * quirks live in `run/` and `engine/` does not import from there.
 */
function userRoster(seed: number): Player[] {
  const rng = createSeededRng(seed)
  const { teams, players } = generateLeague({ teamCount: 2, leagueName: 'L', rng })
  const byId = new Map(players.map((p) => [p.id, p]))
  return teams[0].rosterPlayerIds.map((id) => byId.get(id)!).filter(Boolean)
}

describe('deriveDepthChart', () => {
  it('picks exactly one player per position', () => {
    const roster = userRoster(1)
    const { startingFive } = deriveDepthChart(roster)
    const byId = new Map(roster.map((p) => [p.id, p]))
    const slots = startingFive.map((id) => byId.get(id)!.positions[0])

    expect(startingFive).toHaveLength(5)
    expect(new Set(slots).size).toBe(5)
  })

  it('picks the best player available at each position', () => {
    const roster = userRoster(2)
    const { startingFive } = deriveDepthChart(roster)
    const byId = new Map(roster.map((p) => [p.id, p]))

    for (const id of startingFive) {
      const starter = byId.get(id)!
      const rivals = roster.filter((p) => p.positions[0] === starter.positions[0])
      expect(starter.overallRating).toBe(Math.max(...rivals.map((p) => p.overallRating)))
    }
  })

  it('gives every rostered player a minutes target that sums to a full game per position', () => {
    const roster = userRoster(3)
    const { rotationMinutes } = deriveDepthChart(roster)
    expect(Object.keys(rotationMinutes)).toHaveLength(roster.length)
    for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
      const group = roster.filter((p) => p.positions[0] === position)
      if (group.length === 0) continue
      expect(group.reduce((sum, p) => sum + rotationMinutes[p.id], 0)).toBeCloseTo(48, 6)
    }
  })
})
