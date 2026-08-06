import { describe, expect, it } from 'vitest'
import type { Game, League, Player, Team } from '../data/types'
import { createSeededRng, type Rng } from '../engine/rng'
import { generateLeague } from '../engine/generator/randomLeague'
import { RUN_SEASON_LENGTH, SEASON_CHUNK_COUNT } from './constants'
import type { RunState } from './types'
import { createRun } from './runState'
import { seasonChunkBoundaries } from './seasonChunks'
import { simulateSeasonChunk, type SeasonChunkResult } from './simulateSeasonChunk'

function setUpRun(seed: number) {
  const rng = createSeededRng(seed)
  const { league, teams, players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng })
  const run = createRun(teams[0].id, 'stacked-guards', 'youth-movement', 'mid')
  return { rng, league, teams, players, run }
}

/** Drives a run through every chunk of one season, returning the final (seasonComplete) result. */
function simulateFullSeason(run: RunState, league: League, teams: Team[], players: Player[], rng: Rng): SeasonChunkResult {
  let currentRun = run
  let currentLeague = league
  let currentTeams = teams
  let currentPlayers = players
  let currentGames: Game[] = []
  let last: SeasonChunkResult | undefined

  for (let i = 0; i < SEASON_CHUNK_COUNT; i++) {
    last = simulateSeasonChunk(currentRun, currentLeague, currentTeams, currentPlayers, currentGames, rng)
    currentRun = last.run
    currentLeague = last.league
    currentTeams = last.teams
    currentPlayers = last.players
    currentGames = last.games
  }
  return last as SeasonChunkResult
}

describe('simulateSeasonChunk', () => {
  it('a single chunk only plays its slice of the season, not the whole thing', () => {
    const { rng, league, teams, players, run } = setUpRun(1)
    const totalGames = (RUN_SEASON_LENGTH * teams.length) / 2
    const chunkSize = seasonChunkBoundaries(totalGames, SEASON_CHUNK_COUNT)[0].end

    const result = simulateSeasonChunk(run, league, teams, players, [], rng)

    expect(result.games).toHaveLength(totalGames)
    expect(result.games.filter((g) => g.isPlayed)).toHaveLength(chunkSize)
    expect(result.seasonComplete).toBe(false)
    expect(result.run.chunkInSeason).toBe(1)
  })

  it('strips the possession log from every played game (Coaching Insights are pulled from it first)', () => {
    const { rng, league, teams, players, run } = setUpRun(2)
    const result = simulateSeasonChunk(run, league, teams, players, [], rng)

    for (const game of result.games.filter((g) => g.isPlayed)) {
      expect(game.possessionLog).toEqual([])
      expect(game.result).not.toBeNull()
    }
  })

  it('only surfaces chunkInsights about the run team, never the AI opponents', () => {
    const { rng, league, teams, players, run } = setUpRun(3)
    const result = simulateSeasonChunk(run, league, teams, players, [], rng)

    for (const insight of result.chunkInsights) {
      expect(insight.teamId).toBe(run.teamId)
    }
  })

  it('deduplicates identical-text insights that recur across the chunk\'s several games', () => {
    const { rng, league, teams, players, run } = setUpRun(8)
    const result = simulateSeasonChunk(run, league, teams, players, [], rng)

    const texts = result.chunkInsights.map((i) => i.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('rolls the wildcard event only on a season\'s first chunk, never later ones', () => {
    const { rng, league, teams, players, run } = setUpRun(4)
    const chunk1 = simulateSeasonChunk(run, league, teams, players, [], rng)
    // Whatever chunk1 rolled (or didn't), later chunks in the same season must stay null.
    const chunk2 = simulateSeasonChunk(chunk1.run, chunk1.league, chunk1.teams, chunk1.players, chunk1.games, rng)
    expect(chunk2.wildcardEvent).toBeNull()
  })

  it('running every chunk completes the season: full standings, seasonsPlayed advances, development applied', () => {
    const { rng, league, teams, players, run } = setUpRun(5)
    const result = simulateFullSeason(run, league, teams, players, rng)

    expect(result.seasonComplete).toBe(true)
    expect(result.run.chunkInSeason).toBe(0) // reset for the next season
    expect(result.run.seasonsPlayed).toBe(run.seasonsPlayed + 1)
    expect(result.standings).toHaveLength(teams.length)
    expect(result.games.every((g) => g.isPlayed)).toBe(true)

    const originalAges = new Map(players.map((p) => [p.id, p.age]))
    for (const player of result.players) {
      expect(player.age).toBe((originalAges.get(player.id) ?? 0) + 1)
    }
  })

  it('bumps league.seasonNumber and appends to seasonHistory only once the season completes', () => {
    const { rng, league, teams, players, run } = setUpRun(6)
    const result = simulateFullSeason(run, league, teams, players, rng)

    expect(result.league.seasonNumber).toBe(league.seasonNumber + 1)
    expect(result.league.seasonHistory).toHaveLength(1)
  })

  it('adds budgetEarned onto run.budget only at season completion, not on intermediate chunks', () => {
    const { rng, league, teams, players, run } = setUpRun(7)
    const startingBudget = 500
    const runWithBudget = { ...run, budget: startingBudget }

    const chunk1 = simulateSeasonChunk(runWithBudget, league, teams, players, [], rng)
    expect(chunk1.run.budget).toBe(startingBudget) // untouched mid-season

    const full = simulateFullSeason(runWithBudget, league, teams, players, rng)
    expect(full.budgetEarned).toBeGreaterThanOrEqual(0)
    expect(full.run.budget).toBe(startingBudget + full.budgetEarned)
  })

  it('is deterministic for a given seed across a full season', () => {
    const { league, teams, players, run } = setUpRun(1)
    const resultA = simulateFullSeason(run, league, teams, players, createSeededRng(42))
    const resultB = simulateFullSeason(run, league, teams, players, createSeededRng(42))

    expect(resultA.standings).toEqual(resultB.standings)
    expect(resultA.targetHit).toBe(resultB.targetHit)
  })
})
