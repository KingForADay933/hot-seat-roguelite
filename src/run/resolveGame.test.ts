import { describe, expect, it } from 'vitest'
import type { Game } from '../data/types'
import { generateLeague } from '../engine/generator/randomLeague'
import { createSeededRng } from '../engine/rng'
import { beginSeason } from './beginSeason'
import { createChunkSimContext } from './chunkSimContext'
import { playGameLive, resolveGame } from './resolveGame'
import { createRun } from './runState'

function setUp(seed: number) {
  const rng = createSeededRng(seed)
  const { league, teams, players } = generateLeague({ teamCount: 8, leagueName: 'Test League', rng })
  const run = createRun(teams[0].id, 'stacked-guards', 'youth-movement', 'mid')
  const { games, players: seasonPlayers } = beginSeason(run, league, players, rng)
  const context = createChunkSimContext(run, league, teams, seasonPlayers)

  const runTeamGame = games.find((g) => g.homeTeamId === run.teamId || g.awayTeamId === run.teamId) as Game
  const aiGame = games.find((g) => g.homeTeamId !== run.teamId && g.awayTeamId !== run.teamId) as Game

  return { rng, context, run, runTeamGame, aiGame }
}

describe('resolveGame', () => {
  it('plays a scheduled game and drops its possession log on the way out', () => {
    const { rng, context, run, runTeamGame } = setUp(1)

    const { game } = resolveGame(context, run, runTeamGame, rng)

    expect(game.isPlayed).toBe(true)
    expect(game.result).not.toBeNull()
    expect(game.possessionLog).toEqual([])
  })

  it('harvests insights only about the run team, never the AI opponent', () => {
    const { rng, context, run, runTeamGame } = setUp(2)

    const { insights } = resolveGame(context, run, runTeamGame, rng)

    expect(insights.every((insight) => insight.teamId === run.teamId)).toBe(true)
  })

  it('produces no insights at all for a game the run team is not in', () => {
    const { rng, context, run, aiGame } = setUp(3)

    const { insights } = resolveGame(context, run, aiGame, rng)

    expect(insights).toEqual([])
  })

  it('banks an already-played game verbatim instead of re-simulating it', () => {
    const { context, run, runTeamGame } = setUp(4)

    // Play it once under one seed, then resolve it under a different one. A re-simulation would
    // almost certainly land on a different score -- this is what stops a watched game's result from
    // being silently re-rolled when it's committed.
    const watched = resolveGameFully(context, runTeamGame, 100)
    const { game } = resolveGame(context, run, runTeamGame, createSeededRng(999), watched)

    expect(game.result?.homeScore).toBe(watched.result?.homeScore)
    expect(game.result?.awayScore).toBe(watched.result?.awayScore)
    expect(game.possessionLog).toEqual([])
  })

  it('reads insights out of the already-played log rather than a fresh simulation', () => {
    const { context, run, runTeamGame } = setUp(5)

    const watched = resolveGameFully(context, runTeamGame, 101)
    const first = resolveGame(context, run, runTeamGame, createSeededRng(1), watched)
    const second = resolveGame(context, run, runTeamGame, createSeededRng(2), watched)

    // Same log in, same insights out, under two unrelated seeds -- if either call had re-simulated,
    // the two would diverge.
    expect(first.insights).toEqual(second.insights)
    expect(first.insights.every((insight) => insight.teamId === run.teamId)).toBe(true)
  })
})

/** Drains playGameLive the way the simcast screen does when a GM watches to the final buzzer. */
function resolveGameFully(context: ReturnType<typeof createChunkSimContext>, scheduled: Game, seed: number): Game {
  const steps = playGameLive(context, scheduled, createSeededRng(seed))
  let next = steps.next()
  while (!next.done) next = steps.next()
  return next.value
}

describe('playGameLive', () => {
  it('yields one step per possession and returns the finished game', () => {
    const { context, runTeamGame } = setUp(6)

    const steps = playGameLive(context, runTeamGame, createSeededRng(7))
    let count = 0
    let next = steps.next()
    while (!next.done) {
      count += 1
      expect(next.value.entry.possessionNumber).toBe(count)
      next = steps.next()
    }

    const played = next.value
    expect(played.isPlayed).toBe(true)
    expect(played.result).not.toBeNull()
    // Still carries its log on the way out -- resolveGame needs it for insights before stripping.
    expect(played.possessionLog).toHaveLength(count)
    expect(count).toBeGreaterThanOrEqual(100)
  })

  it('reports the same running score the finished game ends on', () => {
    const { context, runTeamGame } = setUp(8)

    const steps = playGameLive(context, runTeamGame, createSeededRng(9))
    let last = { homeScore: 0, awayScore: 0 }
    let next = steps.next()
    while (!next.done) {
      last = { homeScore: next.value.homeScore, awayScore: next.value.awayScore }
      next = steps.next()
    }

    expect(next.value.result?.homeScore).toBe(last.homeScore)
    expect(next.value.result?.awayScore).toBe(last.awayScore)
  })
})
