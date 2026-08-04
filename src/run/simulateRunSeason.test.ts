import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../engine/rng'
import { generateLeague } from '../engine/generator/randomLeague'
import { RUN_SEASON_LENGTH } from './constants'
import { createRun } from './runState'
import { simulateRunSeason } from './simulateRunSeason'

function setUpRun(seed: number) {
  const rng = createSeededRng(seed)
  const { league, teams, players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng })
  const run = createRun(teams[0].id, 'stacked-guards', 'youth-movement')
  return { rng, league, teams, players, run }
}

describe('simulateRunSeason', () => {
  it('plays every scheduled game and returns a full season of results', () => {
    const { rng, league, teams, players, run } = setUpRun(1)
    const result = simulateRunSeason(run, league, teams, players, rng)

    expect(result.games).toHaveLength((RUN_SEASON_LENGTH * teams.length) / 2)
    expect(result.games.every((g) => g.isPlayed)).toBe(true)
    expect(result.standings).toHaveLength(teams.length)
  })

  it('bumps league.seasonNumber and appends to seasonHistory', () => {
    const { rng, league, teams, players, run } = setUpRun(2)
    const result = simulateRunSeason(run, league, teams, players, rng)

    expect(result.league.seasonNumber).toBe(league.seasonNumber + 1)
    expect(result.league.seasonHistory).toHaveLength(1)
    expect(result.league.seasonHistory[0].seasonNumber).toBe(league.seasonNumber)
  })

  it('advances run.seasonsPlayed by one and reflects targetHit consistently with run status', () => {
    const { rng, league, teams, players, run } = setUpRun(3)
    const result = simulateRunSeason(run, league, teams, players, rng)

    expect(result.run.seasonsPlayed).toBe(run.seasonsPlayed + 1)
    if (result.targetHit) {
      expect(result.run.stretchNumber).toBe(run.stretchNumber + 1)
    } else {
      expect(result.run.stretchNumber).toBe(run.stretchNumber)
    }
  })

  it('is deterministic for a given seed', () => {
    // generateLeague's ids come from createId (Date.now()-based, not the seeded rng), so team/league
    // ids differ across separate generateLeague calls even with the same seed -- generate the league
    // once and only vary the simulation rng to isolate what determinism is actually being tested here.
    const { league, teams, players, run } = setUpRun(1)
    const resultA = simulateRunSeason(run, league, teams, players, createSeededRng(42))
    const resultB = simulateRunSeason(run, league, teams, players, createSeededRng(42))

    expect(resultA.standings).toEqual(resultB.standings)
    expect(resultA.targetHit).toBe(resultB.targetHit)
  })

  it('wildcardEvent is either null or references a real player on the user\'s team', () => {
    const { rng, league, teams, players, run } = setUpRun(5)
    const result = simulateRunSeason(run, league, teams, players, rng)

    if (result.wildcardEvent) {
      const target = players.find((p) => p.id === result.wildcardEvent?.playerId)
      expect(target?.teamId).toBe(run.teamId)
      expect(result.wildcardEvent.playerName).toBe(target?.name)
    } else {
      expect(result.wildcardEvent).toBeNull()
    }
  })

  it('returns players run through development (ages incremented by one)', () => {
    const { rng, league, teams, players, run } = setUpRun(4)
    const result = simulateRunSeason(run, league, teams, players, rng)

    const originalAges = new Map(players.map((p) => [p.id, p.age]))
    for (const player of result.players) {
      expect(player.age).toBe((originalAges.get(player.id) ?? 0) + 1)
    }
  })
})
