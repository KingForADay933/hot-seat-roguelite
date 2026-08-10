import { describe, expect, it } from 'vitest'
import { generateLeague } from '../engine/generator/randomLeague'
import { createSeededRng } from '../engine/rng'
import { beginSeason } from './beginSeason'
import { RUN_SEASON_LENGTH } from './constants'
import { createRun } from './runState'

function setUp(seed: number) {
  const rng = createSeededRng(seed)
  const { league, teams, players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng })
  const run = createRun(teams[0].id, 'stacked-guards', 'youth-movement', 'mid')
  return { rng, league, teams, players, run }
}

describe('beginSeason', () => {
  it('builds a full unplayed schedule before a single game has been simulated', () => {
    const { rng, league, players, run } = setUp(1)

    const { games } = beginSeason(run, league, players, rng)

    // Round-robin: every team plays once per round, so RUN_SEASON_LENGTH games per team across an
    // 8-team league is 4 games a round.
    expect(games).toHaveLength(RUN_SEASON_LENGTH * (league.teamIds.length / 2))
    expect(games.every((game) => !game.isPlayed)).toBe(true)
    expect(games.every((game) => game.result === null)).toBe(true)
  })

  it('gives the run team exactly RUN_SEASON_LENGTH games to work through', () => {
    const { rng, league, players, run } = setUp(2)

    const { games } = beginSeason(run, league, players, rng)
    const runTeamGames = games.filter((g) => g.homeTeamId === run.teamId || g.awayTeamId === run.teamId)

    expect(runTeamGames).toHaveLength(RUN_SEASON_LENGTH)
  })

  it('rolls the season wildcard event and hands back the roster it already landed on', () => {
    // A wildcard fires on roughly 30% of seasons, so the seed has to be *found* rather than
    // assumed. Pinning one was fragile: any change to how much rng league generation consumes moved
    // the stream and silently turned this into a test of nothing.
    let started: ReturnType<typeof beginSeason> | null = null
    let players: ReturnType<typeof setUp>['players'] = []
    for (let seed = 1; seed <= 40 && started?.wildcardEvent == null; seed++) {
      const fixture = setUp(seed)
      players = fixture.players
      started = beginSeason(fixture.run, fixture.league, fixture.players, fixture.rng)
    }

    expect(started, 'no seed in 1-40 rolled a wildcard event').not.toBeNull()
    expect(started!.wildcardEvent).not.toBeNull()
    const startedRun = started!
    // The event is applied to the returned players, not left for the caller to apply.
    const shifted = startedRun.players.find((p) => p.id === startedRun.wildcardEvent?.playerId)
    const before = players.find((p) => p.id === startedRun.wildcardEvent?.playerId)
    expect(shifted).toBeDefined()
    expect(shifted).not.toEqual(before)
  })

  it('always starts a fresh season -- calling it twice discards the first schedule', () => {
    const { rng, league, players, run } = setUp(4)

    const first = beginSeason(run, league, players, rng)
    const second = beginSeason(run, league, players, rng)

    // Documents why callers gate this behind stretchInProgress rather than calling it defensively:
    // there is no "already started" short-circuit inside.
    expect(second.games.map((g) => g.id)).not.toEqual(first.games.map((g) => g.id))
  })
})
