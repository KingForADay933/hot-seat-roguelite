import { describe, expect, it } from 'vitest'
import { makeTestPlayer, makeTestTeam } from '../engine/testFixtures'
import type { Player, Team } from '../data/types'
import { pickWorstTeamId } from './assignWorstTeam'

function teamWithRoster(overallRatings: number[]): { team: Team; players: Player[] } {
  const players = overallRatings.map((overallRating) => ({ ...makeTestPlayer(), overallRating }))
  const team = makeTestTeam({ rosterPlayerIds: players.map((p) => p.id) })
  players.forEach((p) => (p.teamId = team.id))
  return { team, players }
}

describe('pickWorstTeamId', () => {
  it('picks the team with the lowest average roster overall rating', () => {
    const good = teamWithRoster([80, 85, 90])
    const bad = teamWithRoster([40, 45, 50])
    const mid = teamWithRoster([60, 65, 70])

    const teams = [good.team, mid.team, bad.team]
    const players = [...good.players, ...mid.players, ...bad.players]

    expect(pickWorstTeamId(teams, players)).toBe(bad.team.id)
  })

  it('treats a roster with no matching players as average 0 (worst possible)', () => {
    const hasRoster = teamWithRoster([40, 45, 50])
    const empty = makeTestTeam({ rosterPlayerIds: ['ghost-player'] })

    expect(pickWorstTeamId([hasRoster.team, empty], hasRoster.players)).toBe(empty.id)
  })

  it('throws on an empty league', () => {
    expect(() => pickWorstTeamId([], [])).toThrow()
  })
})
