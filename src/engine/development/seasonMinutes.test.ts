import { describe, expect, it } from 'vitest'
import type { Game, PlayerBoxScoreLine } from '../../data/types'
import { aggregateSeasonMinutes } from './seasonMinutes'

function makeLine(playerId: string, minutesPlayed: number): PlayerBoxScoreLine {
  return {
    playerId,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    assists: 0,
    rebounds: 0,
    turnovers: 0,
    fouls: 0,
    minutesPlayed,
  }
}

function makeGame(overrides: Partial<Game> & Pick<Game, 'isPlayed'>): Game {
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

describe('aggregateSeasonMinutes', () => {
  it('sums minutes for one player across a home game and an away game', () => {
    const homeGame = makeGame({
      id: 'g1',
      isPlayed: true,
      result: {
        homeScore: 100,
        awayScore: 90,
        boxScore: { home: [makeLine('p1', 30)], away: [] },
        overtimePeriods: 0,
      },
    })
    const awayGame = makeGame({
      id: 'g2',
      isPlayed: true,
      result: {
        homeScore: 90,
        awayScore: 100,
        boxScore: { home: [], away: [makeLine('p1', 25)] },
        overtimePeriods: 0,
      },
    })

    const minutes = aggregateSeasonMinutes([homeGame, awayGame])
    expect(minutes.get('p1')).toBe(55)
  })

  it('ignores unplayed games', () => {
    const unplayed = makeGame({ id: 'g3', isPlayed: false, result: null })
    const minutes = aggregateSeasonMinutes([unplayed])
    expect(minutes.get('p1')).toBeUndefined()
  })

  it('returns undefined for a player who never appears in any box score', () => {
    const game = makeGame({
      id: 'g4',
      isPlayed: true,
      result: { homeScore: 10, awayScore: 8, boxScore: { home: [makeLine('other', 10)], away: [] }, overtimePeriods: 0 },
    })
    const minutes = aggregateSeasonMinutes([game])
    expect(minutes.get('p1')).toBeUndefined()
  })
})
