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

  it('collapses a problem that recurred across the chunk into one line, counting the games', () => {
    const rng = createSeededRng(2)
    const { league, teams, players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng })
    const run = createRun(teams[0].id, 'stacked-guards', 'youth-movement', 'mid')

    // Same subject, different per-game prose -- which is what the real generator produces, and what
    // the previous exact-text dedupe could never collapse.
    const repeated = (game: number): CoachingInsight => ({
      teamId: run.teamId,
      kind: 'fatigue-substitution',
      subjectId: 'p1',
      subjectName: 'P One',
      text: `P One was pulled with heavy fatigue in the Q${game}, someone checked in.`,
    })
    const distinct: CoachingInsight = { teamId: run.teamId, kind: 'weak-link-targeting', subjectId: 'p2', subjectName: 'P Two', text: 'Something else entirely.' }

    const outcome = finalizeChunk(run, league, teams, players, [], [repeated(1), repeated(2), distinct, repeated(4)])

    expect(outcome.chunkInsights).toHaveLength(2)
    expect(outcome.chunkInsights[0].text).toBe("P One was pulled with heavy fatigue in 3 of this stretch's games.")
    // A single sighting is left exactly as the generator wrote it.
    expect(outcome.chunkInsights[1]).toEqual(distinct)
  })

  it('names the team\'s own defensive scheme in a collapsed weak-link line', () => {
    const rng = createSeededRng(4)
    const { league, teams, players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng })
    const run = createRun(teams[0].id, 'stacked-guards', 'youth-movement', 'mid')
    const withScheme = teams.map((t) => (t.id === run.teamId ? { ...t, defensiveStrategyId: 'switchEverything' } : t))

    const hunted = (points: number): CoachingInsight => ({
      teamId: run.teamId,
      kind: 'weak-link-targeting',
      subjectId: 'p2',
      subjectName: 'P Two',
      metrics: { possessionsTargeted: 30, pointsAllowed: points },
      text: `whatever the per-game line said, allowing ${points} points.`,
    })

    const outcome = finalizeChunk(run, league, withScheme, players, [], [hunted(30), hunted(40)])

    expect(outcome.chunkInsights[0].text).toContain('Switch-Everything')
    expect(outcome.chunkInsights[0].text).toContain('60 possessions, 70 points allowed')
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
