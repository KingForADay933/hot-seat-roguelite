import { describe, expect, it } from 'vitest'
import type { Game } from '../../data/types'
import { makeTestTeam } from '../testFixtures'
import { computeStandings, gamesReachedBy, headToHeadRecord, recordsThroughGame } from './standings'

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

describe('headToHeadRecord', () => {
  it('counts only the two teams\' meetings, from the named team\'s side', () => {
    const a = makeTestTeam()
    const b = makeTestTeam()
    const c = makeTestTeam()
    const games = [
      playedGame(a.id, b.id, 100, 90), // a wins at home
      playedGame(b.id, a.id, 95, 105), // a wins away
      playedGame(b.id, a.id, 110, 100), // b wins
      playedGame(a.id, c.id, 120, 80), // not part of the series
    ]

    expect(headToHeadRecord(games, a.id, b.id)).toEqual({ wins: 2, losses: 1 })
    expect(headToHeadRecord(games, b.id, a.id)).toEqual({ wins: 1, losses: 2 })
  })

  it('is 0-0 for two teams that have not met', () => {
    const a = makeTestTeam()
    const b = makeTestTeam()
    const c = makeTestTeam()
    expect(headToHeadRecord([playedGame(a.id, c.id, 100, 90)], a.id, b.id)).toEqual({ wins: 0, losses: 0 })
  })

  it('ignores scheduled meetings that have not been played', () => {
    const a = makeTestTeam()
    const b = makeTestTeam()
    const unplayed: Game = { ...playedGame(a.id, b.id, 0, 0), isPlayed: false, result: null }
    expect(headToHeadRecord([unplayed], a.id, b.id)).toEqual({ wins: 0, losses: 0 })
  })
})

describe('gamesReachedBy', () => {
  /** Dated games in a fixed order, mirroring the helper in recordsThroughGame's suite above. */
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

  const user = 'team-user'
  const a = 'team-a'
  const b = 'team-b'

  it('is empty before the team has played anything, however much the rest of the league has', () => {
    // The shape a stretch opens in: run/beginStretch resolves every AI-vs-AI game in the chunk up
    // front, so they are `isPlayed` while the GM has not yet touched their own first game.
    const games = [
      datedGame('u1', user, a, 1),
      datedGame('ai1', a, b, 2, [110, 100]),
      datedGame('ai2', b, a, 3, [110, 100]),
    ]
    expect(gamesReachedBy(games, user)).toEqual([])
  })

  it('stops at the last game the team has actually played', () => {
    const games = [
      datedGame('ai1', a, b, 1, [110, 100]),
      datedGame('u1', user, a, 2, [110, 100]),
      datedGame('ai2', b, a, 3, [110, 100]), // resolved, but dated after the GM's progress
      datedGame('u2', user, b, 4),
    ]
    expect(gamesReachedBy(games, user).map((g) => g.id)).toEqual(['ai1', 'u1'])
  })

  it('reads dates rather than array order, since a caller has no obligation to sort', () => {
    const games = [datedGame('ai2', b, a, 3, [110, 100]), datedGame('u1', user, a, 2, [110, 100]), datedGame('ai1', a, b, 1, [110, 100])]
    expect(gamesReachedBy(games, user).map((g) => g.id).sort()).toEqual(['ai1', 'u1'])
  })

  it('carries the record across a chunk boundary rather than resetting it', () => {
    // Chunk 1 finished, chunk 2 just opened with its AI games already resolved. What must survive is
    // the GM's own record from chunk 1 -- a column that restarted at 0-0 every stretch would be a
    // different and much less useful number.
    const games = [
      datedGame('ai1', a, b, 1, [110, 100]),
      datedGame('u1', user, a, 2, [110, 100]), // GM won chunk 1's last game
      datedGame('ai2', b, a, 9, [110, 100]), // chunk 2's AI game, pre-resolved and still ahead of them
      datedGame('u2', user, b, 10),
    ]
    const reached = gamesReachedBy(games, user)
    expect(reached.map((g) => g.id)).toEqual(['ai1', 'u1'])
    expect(recordsThroughGame(reached, 'u1').get(user)).toEqual({ wins: 1, losses: 0 })
  })

  it('feeds recordsThroughGame the season the GM has actually seen', () => {
    const games = [
      datedGame('u1', user, a, 1),
      datedGame('ai1', a, b, 2, [110, 100]),
      datedGame('ai2', a, b, 3, [110, 100]),
    ]
    // Straight through the full list, `a` is 2-0 before the GM has played a game.
    expect(recordsThroughGame(games, 'ai2').get(a)).toEqual({ wins: 2, losses: 0 })
    // Through what the GM has reached, nobody has a record at all.
    expect(recordsThroughGame(gamesReachedBy(games, user), 'ai2').size).toBe(0)
  })
})
