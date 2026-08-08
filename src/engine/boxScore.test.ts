import { describe, expect, it } from 'vitest'
import type { Game, Player, PlayerBoxScoreLine, PlayerId, PossessionLogEntry } from '../data/types'
import { makeTestPlayer } from './testFixtures'
import { aggregateSeasonTotals, deriveBoxScore } from './boxScore'
import type { Rng } from './rng'

function queue(...values: number[]): Rng {
  let i = 0
  return () => values[i++]
}

function playersMap(players: Player[]): Map<PlayerId, Player> {
  return new Map(players.map((p) => [p.id, p]))
}

function makeEntry(overrides: Partial<PossessionLogEntry> & Pick<PossessionLogEntry, 'homeOnCourtIds' | 'awayOnCourtIds'>): PossessionLogEntry {
  return {
    possessionNumber: 1,
    period: 1,
    clockSecondsRemaining: 700,
    // 20s a possession keeps the arithmetic in these tests trivial: three possessions on court is
    // exactly one minute played.
    durationSeconds: 20,
    offenseTeamId: 'home-team',
    playCallUsed: 'isolation',
    primaryPlayerId: overrides.homeOnCourtIds[0],
    secondaryPlayerIds: [],
    outcome: 'turnover',
    pointsScored: 0,
    isThreePointAttempt: false,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    playersInvolved: [],
    ...overrides,
  }
}

describe('deriveBoxScore', () => {
  it('derives points, FG/3P splits, assists, turnovers, fouls, and an approximate rebound from a fixed possession log', () => {
    const h1 = makeTestPlayer({ name: 'H1' })
    const h2 = makeTestPlayer({ name: 'H2' })
    const a1 = makeTestPlayer({ name: 'A1' })
    const a2 = makeTestPlayer({ name: 'A2' })
    const homeTeamId = 'home-team'
    const awayTeamId = 'away-team'
    const homeOnCourtIds = [h1.id, h2.id]
    const awayOnCourtIds = [a1.id, a2.id]

    const log: PossessionLogEntry[] = [
      {
        possessionNumber: 1,
        period: 1,
        clockSecondsRemaining: 700,
        durationSeconds: 20,
        offenseTeamId: homeTeamId,
        playCallUsed: 'post-up',
        primaryPlayerId: h1.id,
        secondaryPlayerIds: [],
        outcome: 'make',
        pointsScored: 2,
        isThreePointAttempt: false,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        playersInvolved: [h1.id, a1.id],
        homeOnCourtIds,
        awayOnCourtIds,
      },
      {
        possessionNumber: 2,
        period: 1,
        clockSecondsRemaining: 700,
        durationSeconds: 20,
        offenseTeamId: awayTeamId,
        playCallUsed: 'spot-up',
        primaryPlayerId: a1.id,
        secondaryPlayerIds: [a2.id],
        outcome: 'make',
        pointsScored: 3,
        isThreePointAttempt: true,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        playersInvolved: [a1.id, a2.id, h1.id],
        homeOnCourtIds,
        awayOnCourtIds,
      },
      {
        possessionNumber: 3,
        period: 1,
        clockSecondsRemaining: 700,
        durationSeconds: 20,
        offenseTeamId: homeTeamId,
        playCallUsed: 'spot-up',
        primaryPlayerId: h1.id,
        secondaryPlayerIds: [h2.id],
        outcome: 'miss',
        pointsScored: 0,
        isThreePointAttempt: true,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        playersInvolved: [h1.id, h2.id, a1.id],
        homeOnCourtIds,
        awayOnCourtIds,
      },
      {
        possessionNumber: 4,
        period: 1,
        clockSecondsRemaining: 700,
        durationSeconds: 20,
        offenseTeamId: awayTeamId,
        playCallUsed: 'isolation',
        primaryPlayerId: a2.id,
        secondaryPlayerIds: [],
        outcome: 'turnover',
        pointsScored: 0,
        isThreePointAttempt: false,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        playersInvolved: [a2.id, h1.id],
        homeOnCourtIds,
        awayOnCourtIds,
      },
      {
        possessionNumber: 5,
        period: 1,
        clockSecondsRemaining: 700,
        durationSeconds: 20,
        offenseTeamId: homeTeamId,
        playCallUsed: 'post-up',
        primaryPlayerId: h2.id,
        secondaryPlayerIds: [],
        outcome: 'foul',
        pointsScored: 0,
        isThreePointAttempt: false,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        playersInvolved: [h2.id, a1.id],
        homeOnCourtIds,
        awayOnCourtIds,
      },
    ]

    // Possession 3 is the only miss: rng[0]=0.9 forces the defense (away) to recover (>= the 0.25 offensive-rebound rate),
    // rng[1]=0.1 lands in A1's weighted band (A1 is first in awayOnCourt with equal 50 rebounding, band [0,50) of a 100 total).
    const rng = queue(0.9, 0.1)

    const result = deriveBoxScore(log, homeTeamId, playersMap([h1, h2, a1, a2]), rng)

    expect(result.homeScore).toBe(2)
    expect(result.awayScore).toBe(3)

    const h1Line = result.boxScore.home.find((l) => l.playerId === h1.id)!
    expect(h1Line).toMatchObject({ points: 2, fieldGoalsMade: 1, fieldGoalsAttempted: 2, threePointersAttempted: 1, threePointersMade: 0 })
    expect(h1Line.minutesPlayed).toBeCloseTo((5 * 20) / 60, 5) // on court for all 5 possessions, 20s each

    const h2Line = result.boxScore.home.find((l) => l.playerId === h2.id)!
    expect(h2Line.fouls).toBe(1)

    const a1Line = result.boxScore.away.find((l) => l.playerId === a1.id)!
    expect(a1Line).toMatchObject({ points: 3, fieldGoalsMade: 1, fieldGoalsAttempted: 1, threePointersMade: 1, threePointersAttempted: 1, rebounds: 1 })

    const a2Line = result.boxScore.away.find((l) => l.playerId === a2.id)!
    expect(a2Line.assists).toBe(1)
    expect(a2Line.turnovers).toBe(1)
  })

  it('includes every on-court player in the box score even if they never touched the ball', () => {
    const h1 = makeTestPlayer()
    const h2 = makeTestPlayer()
    const a1 = makeTestPlayer()
    const log = [makeEntry({ homeOnCourtIds: [h1.id, h2.id], awayOnCourtIds: [a1.id] })]

    const result = deriveBoxScore(log, 'home-team', playersMap([h1, h2, a1]), () => 0.5)

    expect(result.boxScore.home.map((l) => l.playerId).sort()).toEqual([h1.id, h2.id].sort())
    expect(result.boxScore.away.map((l) => l.playerId)).toEqual([a1.id])
    const h2Line = result.boxScore.home.find((l) => l.playerId === h2.id)!
    expect(h2Line).toMatchObject({ points: 0, fieldGoalsAttempted: 0, rebounds: 0, assists: 0, turnovers: 0, fouls: 0 })
  })

  it('sums minutesPlayed from each possession\'s own duration', () => {
    const h1 = makeTestPlayer()
    const a1 = makeTestPlayer()
    // h1 on court for 3 of 5 possessions, each 20 seconds long
    const log = [1, 2, 3, 4, 5].map((n) =>
      makeEntry({
        possessionNumber: n,
        homeOnCourtIds: n <= 3 ? [h1.id] : [makeTestPlayer().id],
        awayOnCourtIds: [a1.id],
      }),
    )

    const result = deriveBoxScore(log, 'home-team', playersMap([h1, a1]), () => 0.5)

    const h1Line = result.boxScore.home.find((l) => l.playerId === h1.id)!
    expect(h1Line.minutesPlayed).toBeCloseTo((3 * 20) / 60, 5)
    const a1Line = result.boxScore.away.find((l) => l.playerId === a1.id)!
    expect(a1Line.minutesPlayed).toBeCloseTo((5 * 20) / 60, 5) // on court every possession
  })

  it('weights minutes by how long each possession actually took', () => {
    const starter = makeTestPlayer()
    const opponent = makeTestPlayer()
    // A four-second fast break should cost a quarter of what a sixteen-second half-court set does.
    const log = [
      makeEntry({ possessionNumber: 1, durationSeconds: 4, homeOnCourtIds: [starter.id], awayOnCourtIds: [opponent.id] }),
      makeEntry({ possessionNumber: 2, durationSeconds: 16, homeOnCourtIds: [starter.id], awayOnCourtIds: [opponent.id] }),
    ]

    const result = deriveBoxScore(log, 'home-team', playersMap([starter, opponent]), () => 0.5)

    expect(result.boxScore.home[0].minutesPlayed).toBeCloseTo(20 / 60, 5)
  })

  it('gives a mid-game entrant correct partial minutes', () => {
    const h1 = makeTestPlayer({ name: 'StaysAllGame' })
    const h2 = makeTestPlayer({ name: 'StartsThenSubbedOut' })
    const h3 = makeTestPlayer({ name: 'EntersMidGame' })
    const a1 = makeTestPlayer()

    const log = [
      makeEntry({ possessionNumber: 1, homeOnCourtIds: [h1.id, h2.id], awayOnCourtIds: [a1.id] }),
      makeEntry({ possessionNumber: 2, homeOnCourtIds: [h1.id, h3.id], awayOnCourtIds: [a1.id] }),
      makeEntry({ possessionNumber: 3, homeOnCourtIds: [h1.id, h3.id], awayOnCourtIds: [a1.id] }),
      makeEntry({ possessionNumber: 4, homeOnCourtIds: [h1.id, h3.id], awayOnCourtIds: [a1.id] }),
      makeEntry({ possessionNumber: 5, homeOnCourtIds: [h1.id, h3.id], awayOnCourtIds: [a1.id] }),
    ]

    const result = deriveBoxScore(log, 'home-team', playersMap([h1, h2, h3, a1]), () => 0.5)

    expect(result.boxScore.home.find((l) => l.playerId === h2.id)!.minutesPlayed).toBeCloseTo((1 * 20) / 60, 5)
    expect(result.boxScore.home.find((l) => l.playerId === h3.id)!.minutesPlayed).toBeCloseTo((4 * 20) / 60, 5)
    expect(result.boxScore.home.find((l) => l.playerId === h1.id)!.minutesPlayed).toBeCloseTo((5 * 20) / 60, 5)
  })
})

function makeStatLine(playerId: PlayerId, overrides: Partial<PlayerBoxScoreLine> = {}): PlayerBoxScoreLine {
  return {
    playerId,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    assists: 0,
    rebounds: 0,
    turnovers: 0,
    fouls: 0,
    minutesPlayed: 0,
    ...overrides,
  }
}

function makeSeasonGame(overrides: Partial<Game> & Pick<Game, 'isPlayed'>): Game {
  return {
    id: 'game-1',
    leagueId: 'league-1',
    homeTeamId: 'home',
    awayTeamId: 'away',
    date: new Date().toISOString(),
    result: null,
    possessionLog: [],
    isSaved: false,
    ...overrides,
  }
}

describe('aggregateSeasonTotals', () => {
  it('sums stat totals for one player across a home game and an away game, incrementing gamesPlayed once per game', () => {
    const homeGame = makeSeasonGame({
      id: 'g1',
      isPlayed: true,
      result: {
        homeScore: 100,
        awayScore: 90,
        overtimePeriods: 0,
        boxScore: { home: [makeStatLine('p1', { points: 20, rebounds: 5, minutesPlayed: 30 })], away: [] },
      },
    })
    const awayGame = makeSeasonGame({
      id: 'g2',
      isPlayed: true,
      result: {
        homeScore: 90,
        awayScore: 100,
        overtimePeriods: 0,
        boxScore: { home: [], away: [makeStatLine('p1', { points: 15, rebounds: 3, minutesPlayed: 25 })] },
      },
    })

    const totals = aggregateSeasonTotals([homeGame, awayGame]).get('p1')!
    expect(totals.gamesPlayed).toBe(2)
    expect(totals.points).toBe(35)
    expect(totals.rebounds).toBe(8)
    expect(totals.minutesPlayed).toBe(55)
  })

  it('ignores unplayed games', () => {
    const unplayed = makeSeasonGame({ id: 'g3', isPlayed: false, result: null })
    const totals = aggregateSeasonTotals([unplayed])
    expect(totals.get('p1')).toBeUndefined()
  })

  it('returns undefined for a player who never appears in any box score', () => {
    const game = makeSeasonGame({
      id: 'g4',
      isPlayed: true,
      result: { homeScore: 10, awayScore: 8, overtimePeriods: 0, boxScore: { home: [makeStatLine('other')], away: [] } },
    })
    const totals = aggregateSeasonTotals([game])
    expect(totals.get('p1')).toBeUndefined()
  })
})
