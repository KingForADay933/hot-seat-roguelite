import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../../engine/rng'
import { makeTestPlayer, makeTestTeam } from '../../engine/testFixtures'
import type { Player, Position, Team } from '../../data/types'
import { applyHouseRule, HOUSE_RULES, pickRandomHouseRule } from './houseRules'

function buildTeam(ages: Record<Position, number[]>): { team: Team; players: Player[] } {
  const players: Player[] = []
  const rosterPlayerIds: string[] = []
  const startingFive: string[] = []

  ;(Object.keys(ages) as Position[]).forEach((position) => {
    ages[position].forEach((age, i) => {
      const player = makeTestPlayer({ positions: [position], age })
      players.push(player)
      rosterPlayerIds.push(player.id)
      if (i === 0) startingFive.push(player.id) // first entry per position starts
    })
  })

  const team = makeTestTeam({ rosterPlayerIds, startingFive })
  players.forEach((p) => (p.teamId = team.id))
  return { team, players }
}

describe('applyHouseRule / youth-movement', () => {
  it('is a no-op when at least 2 starters are already young', () => {
    const { team, players } = buildTeam({ PG: [20], SG: [21], SF: [30], PF: [30], C: [30] })
    const result = applyHouseRule('youth-movement', team, players)
    expect(result.team.startingFive).toEqual(team.startingFive)
  })

  it('swaps in same-position young bench players until 2 starters qualify', () => {
    const { team, players } = buildTeam({ PG: [30, 20], SG: [30, 21], SF: [30], PF: [30], C: [30] })
    const result = applyHouseRule('youth-movement', team, players)

    const byId = new Map(players.map((p) => [p.id, p]))
    const newStarters = result.team.startingFive.map((id) => byId.get(id)!)
    expect(newStarters.filter((p) => p.age <= 22)).toHaveLength(2)
    // still exactly one starter per position -- the matchup system's invariant
    expect(new Set(newStarters.map((p) => p.positions[0])).size).toBe(5)
  })

  it('is best-effort when there are not enough young candidates anywhere', () => {
    const { team, players } = buildTeam({ PG: [30], SG: [30], SF: [30], PF: [30], C: [30] })
    const result = applyHouseRule('youth-movement', team, players)
    expect(result.team.startingFive).toEqual(team.startingFive) // no young players exist at all -- unchanged
  })
})

describe('applyHouseRule / short-bench', () => {
  it('trims the roster to the target size, keeping all starters', () => {
    const ages: Record<Position, number[]> = {
      PG: [25, 25, 25],
      SG: [25, 25, 25],
      SF: [25, 25],
      PF: [25, 25],
      C: [25, 25],
    }
    const { team, players } = buildTeam(ages)
    const result = applyHouseRule('short-bench', team, players)

    expect(result.team.rosterPlayerIds).toHaveLength(8)
    expect(team.startingFive.every((id) => result.team.rosterPlayerIds.includes(id))).toBe(true)
  })

  it('sets cut players teamId to null rather than removing them', () => {
    const ages: Record<Position, number[]> = { PG: [25, 25, 25], SG: [25, 25, 25], SF: [25, 25], PF: [25, 25], C: [25, 25] }
    const { team, players } = buildTeam(ages)
    const result = applyHouseRule('short-bench', team, players)

    expect(result.players).toHaveLength(players.length)
    const cut = result.players.filter((p) => p.teamId === null)
    expect(cut.length).toBe(players.length - 8)
  })

  it('is a no-op when the roster is already at or below the target size', () => {
    const ages: Record<Position, number[]> = { PG: [25], SG: [25], SF: [25], PF: [25], C: [25] }
    const { team, players } = buildTeam(ages)
    const result = applyHouseRule('short-bench', team, players)
    expect(result.team.rosterPlayerIds).toEqual(team.rosterPlayerIds)
  })
})

describe('pickRandomHouseRule', () => {
  it('always returns a valid rule id', () => {
    const rng = createSeededRng(9)
    for (let i = 0; i < 20; i++) {
      expect(Object.keys(HOUSE_RULES)).toContain(pickRandomHouseRule(rng))
    }
  })
})
