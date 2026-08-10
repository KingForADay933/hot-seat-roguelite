import { describe, expect, it } from 'vitest'
import type { Game } from '../../data/types'
import { makeTestTeam } from '../testFixtures'
import { computeStandings, recordsThroughGame } from './standings'

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

describe('recordsThroughGame', () => {
  /** Dated games in a fixed order, so "through this one" has a meaning to test against. */
  function datedGame(id: string, homeTeamId: string, awayTeamId: string, day: number, score?: [number, number]): Game {
    return {
      id,
      leagueId: 'league-1',
      homeTeamId,
      awayTeamId,
      date: new Date(Date.UTC(2026, 0, day)).toISOString(),
      isPlayed: score !== undefined,
      result: score ? { homeScore: score[0], awayScore: score[1], boxScore: { home: [], away: [] }, overtimePeriods: 0 } : null,
      possessionLog: [],
      isSaved: false,
    }
  }

  const a = 'team-a'
  const b = 'team-b'

  it('counts through the named game and stops', () => {
    const games = [
      datedGame('g1', a, b, 1, [110, 100]), // a wins
      datedGame('g2', b, a, 2, [110, 100]), // b wins
      datedGame('g3', a, b, 3, [110, 100]), // a wins
    ]

    expect(recordsThroughGame(games, 'g1').get(a)).toEqual({ wins: 1, losses: 0 })
    expect(recordsThroughGame(games, 'g2').get(a)).toEqual({ wins: 1, losses: 1 })
    expect(recordsThroughGame(games, 'g3').get(a)).toEqual({ wins: 2, losses: 1 })
  })

  it('reads the schedule in date order, not array order', () => {
    // Deliberately shuffled: the caller has no obligation to hand these over sorted.
    const games = [datedGame('g3', a, b, 3, [110, 100]), datedGame('g1', a, b, 1, [110, 100]), datedGame('g2', b, a, 2, [110, 100])]
    expect(recordsThroughGame(games, 'g1').get(a)).toEqual({ wins: 1, losses: 0 })
  })

  it('gives an unplayed game the record both teams carry into it', () => {
    const games = [datedGame('g1', a, b, 1, [110, 100]), datedGame('g2', b, a, 2)]

    expect(recordsThroughGame(games, 'g2').get(a)).toEqual({ wins: 1, losses: 0 })
    expect(recordsThroughGame(games, 'g2').get(b)).toEqual({ wins: 0, losses: 1 })
  })

  it('ignores games after the cutoff even when they are already played', () => {
    // The stretch screen can show a finished game above one that was simmed earlier in real time;
    // the row must still read as of its own place in the schedule.
    const games = [datedGame('g1', a, b, 1), datedGame('g2', b, a, 2, [110, 100])]
    expect(recordsThroughGame(games, 'g1').get(a)).toBeUndefined()
  })

  it('falls back to the whole played schedule for a game it has never heard of', () => {
    const games = [datedGame('g1', a, b, 1, [110, 100])]
    expect(recordsThroughGame(games, 'not-a-game').get(a)).toEqual({ wins: 1, losses: 0 })
  })

  it('is empty before anything has been played', () => {
    expect(recordsThroughGame([datedGame('g1', a, b, 1)], 'g1').size).toBe(0)
  })
})
