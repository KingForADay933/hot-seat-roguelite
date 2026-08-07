import { describe, expect, it } from 'vitest'
import type { CoachingInsight } from '../engine/insights/generateCoachingInsights'
import { generateLeague } from '../engine/generator/randomLeague'
import { createSeededRng } from '../engine/rng'
import { beginSeason } from './beginSeason'
import { createChunkSimContext } from './chunkSimContext'
import { SEASON_CHUNK_COUNT } from './constants'
import { finalizeChunk } from './finalizeChunk'
import { resolveGame } from './resolveGame'
import { createRun } from './runState'
import { chunkRange } from './seasonChunks'
import type { RunState } from './types'

/** Plays every game of a season the way the stretch screen does -- one at a time, closing each chunk
 *  with finalizeChunk -- and hands back where the run ended up. */
function playSeasonOneGameAtATime(seed: number) {
  const rng = createSeededRng(seed)
  const { league, teams, players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng })
  const run = createRun(teams[0].id, 'stacked-guards', 'youth-movement', 'mid')

  const started = beginSeason(run, league, players, rng)
  let currentRun: RunState = run
  let currentLeague = league
  let currentPlayers = started.players
  let games = started.games
  let outcome!: ReturnType<typeof finalizeChunk>

  for (let chunk = 0; chunk < SEASON_CHUNK_COUNT; chunk++) {
    const context = createChunkSimContext(currentRun, currentLeague, teams, currentPlayers)
    const { start, end } = chunkRange(games.length, currentRun.chunkInSeason)
    const insights: CoachingInsight[] = []
    const updated = [...games]

    for (let i = start; i < end; i++) {
      const resolved = resolveGame(context, currentRun, updated[i], rng)
      updated[i] = resolved.game
      insights.push(...resolved.insights)
    }

    outcome = finalizeChunk(currentRun, currentLeague, teams, currentPlayers, updated, insights)
    currentRun = outcome.run
    currentLeague = outcome.league
    currentPlayers = outcome.players
    games = outcome.games
  }

  return outcome
}

describe('finalizeChunk', () => {
  it('advances the chunk counter without touching the season on a non-final chunk', () => {
    const rng = createSeededRng(1)
    const { league, teams, players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng })
    const run = createRun(teams[0].id, 'stacked-guards', 'youth-movement', 'mid')

    const outcome = finalizeChunk(run, league, teams, players, [], [])

    expect(outcome.run.chunkInSeason).toBe(1)
    expect(outcome.seasonComplete).toBe(false)
    expect(outcome.standings).toEqual([])
    expect(outcome.budgetEarned).toBe(0)
    expect(outcome.league.seasonNumber).toBe(league.seasonNumber)
  })

  it('collapses insights that repeat verbatim across the chunk', () => {
    const rng = createSeededRng(2)
    const { league, teams, players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng })
    const run = createRun(teams[0].id, 'stacked-guards', 'youth-movement', 'mid')

    const repeated: CoachingInsight = { teamId: run.teamId, text: 'Same line, three games running.' }
    const distinct: CoachingInsight = { teamId: run.teamId, text: 'Something else entirely.' }

    const outcome = finalizeChunk(run, league, teams, players, [], [repeated, repeated, distinct, repeated])

    expect(outcome.chunkInsights).toEqual([repeated, distinct])
  })

  it('runs the season-end pipeline once the last chunk closes', () => {
    const outcome = playSeasonOneGameAtATime(3)

    expect(outcome.seasonComplete).toBe(true)
    expect(outcome.standings).toHaveLength(8)
    expect(outcome.run.seasonsPlayed).toBe(1)
    // A fresh season boundary: the next chunk to play is chunk 0 of the following season.
    expect(outcome.run.chunkInSeason).toBe(0)
    expect(outcome.league.seasonHistory).toHaveLength(1)
    expect(outcome.league.seasonNumber).toBe(2)
  })

  it('gets a season played game-by-game to the same shape the batch path reaches', () => {
    const outcome = playSeasonOneGameAtATime(4)

    // Every game played, every possession log gone -- the invariant the checkpoint screens rely on,
    // reached without simulateSeasonChunk ever being called.
    expect(outcome.games.every((game) => game.isPlayed)).toBe(true)
    expect(outcome.games.every((game) => game.possessionLog.length === 0)).toBe(true)
    const totalWins = outcome.standings.reduce((sum, row) => sum + row.wins, 0)
    expect(totalWins).toBe(outcome.games.length)
  })
})
