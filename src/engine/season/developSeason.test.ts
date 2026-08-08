import { describe, expect, it } from 'vitest'
import type { Game, PlayerBoxScoreLine } from '../../data/types'
import { ATTRIBUTE_FLOOR } from '../constants'
import { makeTestPlayer, makeTestTeam } from '../testFixtures'
import { developSeason } from './developSeason'

function makeLine(playerId: string, minutesPlayed: number): PlayerBoxScoreLine {
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
    minutesPlayed,
  }
}

function makePlayedGame(homeTeamId: string, homeLines: PlayerBoxScoreLine[]): Game {
  return {
    id: `game-${homeTeamId}-${Math.random()}`,
    leagueId: 'league-1',
    homeTeamId,
    awayTeamId: 'other-team',
    date: new Date().toISOString(),
    isPlayed: true,
    result: { homeScore: 100, awayScore: 90, boxScore: { home: homeLines, away: [] }, overtimePeriods: 0 },
    possessionLog: [],
    isSaved: false,
  }
}

const FULL_POTENTIAL = {
  insideShot: 90,
  outsideShot: 90,
  passing: 90,
  ballHandling: 90,
  rebounding: 90,
  perimeterDefense: 90,
  interiorDefense: 90,
  speed: 90,
  lateralQuickness: 90,
  vertical: 90,
}

describe('developSeason', () => {
  it('grows a young, heavy-minutes player toward their potential', () => {
    const young = makeTestPlayer({
      name: 'Young',
      age: 19,
      attributes: { insideShot: 50 },
      development: { ageCurveStage: 'rising', potential: FULL_POTENTIAL },
    })
    const team = makeTestTeam({
      rosterPlayerIds: [young.id],
      coaching: { headCoachRating: 90 },
      practiceSettings: { individualDevelopmentShare: 100 },
    })
    young.teamId = team.id

    const games = [makePlayedGame(team.id, [makeLine(young.id, 35)])]
    const [developed] = developSeason([young], [team], games)

    expect(developed.attributes.insideShot).toBeGreaterThan(50)
    expect(developed.development.developmentPoints).toBeGreaterThan(0)
    expect(developed.age).toBe(20)
  })

  it('declines a low-minutes veteran with no practice investment and no exceptional coaching, staying at or above the decline floor', () => {
    const veteran = makeTestPlayer({
      name: 'Veteran',
      age: 37,
      attributes: { insideShot: 60 },
      development: { ageCurveStage: 'declining', potential: FULL_POTENTIAL },
    })
    const team = makeTestTeam({
      rosterPlayerIds: [veteran.id],
      coaching: { headCoachRating: 65 },
      practiceSettings: { individualDevelopmentShare: 0 },
    })
    veteran.teamId = team.id

    const games = [makePlayedGame(team.id, [makeLine(veteran.id, 2)])]
    const [developed] = developSeason([veteran], [team], games)

    expect(developed.development.developmentPoints).toBeLessThan(0)
    expect(developed.attributes.insideShot).toBeLessThan(60)
    expect(developed.attributes.insideShot).toBeGreaterThanOrEqual(ATTRIBUTE_FLOOR)
  })

  it('only ages a player with no current team, without crashing', () => {
    const freeAgent = makeTestPlayer({ name: 'FreeAgent', age: 25 })
    freeAgent.teamId = null

    const [developed] = developSeason([freeAgent], [], [])
    expect(developed.age).toBe(26)
    expect(developed.attributes).toEqual(freeAgent.attributes)
  })
})
