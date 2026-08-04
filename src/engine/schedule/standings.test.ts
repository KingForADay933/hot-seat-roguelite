import { describe, expect, it } from 'vitest'
import type { Game } from '../../data/types'
import { makeTestTeam } from '../testFixtures'
import { computeStandings } from './standings'

function playedGame(homeTeamId: string, awayTeamId: string, homeScore: number, awayScore: number): Game {
  return {
    id: `${homeTeamId}-vs-${awayTeamId}`,
    leagueId: 'league-1',
    homeTeamId,
    awayTeamId,
    date: new Date().toISOString(),
    isPlayed: true,
    result: { homeScore, awayScore, boxScore: { home: [], away: [] }, overtimePeriods: 0 },
    possessionLog: [],
    isSaved: false,
  }
}

describe('computeStandings', () => {
  it('computes wins/losses/win% and point differential from completed games', () => {
    const a = makeTestTeam()
    const b = makeTestTeam()
    const games = [playedGame(a.id, b.id, 100, 90), playedGame(b.id, a.id, 95, 105)]

    const standings = computeStandings([a, b], games)
    const aRow = standings.find((r) => r.teamId === a.id)!
    const bRow = standings.find((r) => r.teamId === b.id)!

    expect(aRow).toMatchObject({ wins: 2, losses: 0, winPct: 1, pointsFor: 205, pointsAgainst: 185, pointDiff: 20 })
    expect(bRow).toMatchObject({ wins: 0, losses: 2, winPct: 0 })
  })

  it('ignores unplayed games', () => {
    const a = makeTestTeam()
    const b = makeTestTeam()
    const unplayed: Game = { ...playedGame(a.id, b.id, 0, 0), isPlayed: false, result: null }
    const standings = computeStandings([a, b], [unplayed])
    expect(standings.every((r) => r.wins === 0 && r.losses === 0)).toBe(true)
  })

  it('sorts by win percentage descending, then point differential as a tiebreak', () => {
    const a = makeTestTeam()
    const b = makeTestTeam()
    const c = makeTestTeam()
    // a: 1-0 big win; b: 1-0 small win; c: 0-1
    const games = [playedGame(a.id, c.id, 120, 80), playedGame(b.id, c.id, 101, 100), playedGame(c.id, a.id, 50, 130)]
    const standings = computeStandings([a, b, c], games)
    expect(standings.map((r) => r.teamId)).toEqual([a.id, b.id, c.id])
  })

  it('includes every team even with zero games played', () => {
    const a = makeTestTeam()
    const b = makeTestTeam()
    const standings = computeStandings([a, b], [])
    expect(standings).toHaveLength(2)
    expect(standings.every((r) => r.winPct === 0)).toBe(true)
  })
})
