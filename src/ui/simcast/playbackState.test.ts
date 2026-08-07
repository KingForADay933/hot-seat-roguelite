import { describe, expect, it } from 'vitest'
import type { Game, Player, PlayerId, Team } from '../../data/types'
import { deriveBoxScore } from '../../engine/boxScore'
import { generateLeague } from '../../engine/generator/randomLeague'
import { createSeededRng } from '../../engine/rng'
import { tickFatigue } from '../../engine/rotation/fatigue'
import { createRotationState } from '../../engine/rotation/rotationState'
import { simulateGameSteps, type SimulationStep } from '../../engine/simulateGame'
import { advancePlayback, createPlaybackState, type PlaybackContext, type PlaybackState } from './playbackState'

const POSSESSIONS_PER_GAME = 100

/** Plays one real game and hands back every step, so a test can fold the same possessions through
 *  the playback reducer that the engine just produced. */
function playOneGame(seed: number) {
  const rng = createSeededRng(seed)
  const { league, teams, players } = generateLeague({ teamCount: 2, leagueName: 'Playback Test League', rng })
  const playerById = new Map(players.map((p) => [p.id, p]))

  const homeTeam = teams[0]
  const awayTeam = teams[1]
  const scheduled: Game = {
    id: 'game-1',
    leagueId: league.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    date: new Date().toISOString(),
    isPlayed: false,
    result: null,
    possessionLog: [],
    isSaved: false,
  }

  const steps: SimulationStep[] = []
  const generator = simulateGameSteps(scheduled, homeTeam, awayTeam, playerById, POSSESSIONS_PER_GAME, rng)
  let next = generator.next()
  while (!next.done) {
    steps.push(next.value)
    next = generator.next()
  }

  const roster = (team: Team): Player[] => team.rosterPlayerIds.map((id) => playerById.get(id)!)
  const context: PlaybackContext = {
    homeRoster: roster(homeTeam),
    awayRoster: roster(awayTeam),
    playerById,
    possessionsPerGame: POSSESSIONS_PER_GAME,
  }

  return { steps, context, played: next.value, homeTeam, awayTeam, playerById, rng }
}

function foldAll(context: PlaybackContext, steps: SimulationStep[]): PlaybackState {
  return steps.reduce((state, step) => advancePlayback(context, state, step), createPlaybackState(context))
}

describe('advancePlayback', () => {
  it('tracks the running score the simulation reported, possession for possession', () => {
    const { steps, context } = playOneGame(11)

    let state = createPlaybackState(context)
    for (const step of steps) {
      state = advancePlayback(context, state, step)
      expect(state.homeScore).toBe(step.homeScore)
      expect(state.awayScore).toBe(step.awayScore)
    }
    expect(state.possessionsPlayed).toBe(steps.length)
  })

  it('shows the five the log says were actually on the floor, substitutions included', () => {
    const { steps, context } = playOneGame(12)
    const state = foldAll(context, steps)
    const lastEntry = steps[steps.length - 1].entry

    expect(state.homeOnCourtIds).toEqual(lastEntry.homeOnCourtIds)
    expect(state.awayOnCourtIds).toEqual(lastEntry.awayOnCourtIds)
    // A full game should have rotated somebody in off the bench -- otherwise the assertion above is
    // just checking the starting five never moved.
    const everOnCourt = new Set(steps.flatMap((s) => s.entry.homeOnCourtIds))
    expect(everOnCourt.size).toBeGreaterThan(5)
  })

  it('reproduces the engine-side fatigue numbers rather than approximating them', () => {
    const { steps, context, homeTeam, playerById } = playOneGame(13)

    // An independent RotationState driven through tickFatigue with the on-court five the log
    // recorded -- exactly what simulateGameSteps did internally as it played.
    const rotation = createRotationState(homeTeam, playerById)
    for (const step of steps) {
      rotation.onCourt = step.entry.homeOnCourtIds.map((id) => playerById.get(id)!)
      tickFatigue(rotation, context.homeRoster)
    }

    const state = foldAll(context, steps)
    for (const player of context.homeRoster) {
      expect(state.fatigue.get(player.id)).toBeCloseTo(rotation.fatigue.get(player.id) as number, 8)
    }
  })

  it('matches the official box score on every stat the possession log determines', () => {
    const { steps, context, homeTeam, playerById, rng } = playOneGame(14)
    const state = foldAll(context, steps)

    const official = deriveBoxScore(
      steps.map((s) => s.entry),
      homeTeam.id,
      playerById,
      POSSESSIONS_PER_GAME,
      rng,
    )

    expect(official.boxScore.home.length).toBeGreaterThan(0)
    for (const line of official.boxScore.home) {
      const live = state.lines.get(line.playerId)
      expect(live, `no live line for ${line.playerId}`).toBeDefined()
      // Rebounds are deliberately absent from the live line -- deriveBoxScore rolls for them, so
      // they can't be replayed and aren't shown until the buzzer.
      expect(live).toMatchObject({
        points: line.points,
        fieldGoalsMade: line.fieldGoalsMade,
        fieldGoalsAttempted: line.fieldGoalsAttempted,
        threePointersMade: line.threePointersMade,
        threePointersAttempted: line.threePointersAttempted,
        assists: line.assists,
        turnovers: line.turnovers,
        fouls: line.fouls,
      })
      expect(live?.minutesPlayed).toBeCloseTo(line.minutesPlayed, 8)
    }
  })

  it('captions each possession and keeps the newest line first', () => {
    const { steps, context } = playOneGame(15)
    const state = foldAll(context, steps)

    expect(state.feed[0].possessionNumber).toBe(steps[steps.length - 1].entry.possessionNumber)
    expect(state.feed[0].text.length).toBeGreaterThan(0)
    // Descending, so the screen renders top-down without reversing on every frame.
    const numbers = state.feed.map((entry) => entry.possessionNumber)
    expect([...numbers].sort((a, b) => b - a)).toEqual(numbers)
  })

  it('leaves state untouched -- a folded step returns a new object', () => {
    const { steps, context } = playOneGame(16)
    const first = createPlaybackState(context)
    const second = advancePlayback(context, first, steps[0])

    expect(second).not.toBe(first)
    expect(first.possessionsPlayed).toBe(0)
    expect(first.feed).toHaveLength(0)
    expect(first.fatigue.get(context.homeRoster[0].id)).toBe(0)
  })
})

describe('createPlaybackState', () => {
  it('starts everyone on both rosters at zero fatigue, bench included', () => {
    const { context } = playOneGame(17)
    const state = createPlaybackState(context)
    const everyone: PlayerId[] = [...context.homeRoster, ...context.awayRoster].map((p) => p.id)

    expect(state.fatigue.size).toBe(everyone.length)
    for (const id of everyone) expect(state.fatigue.get(id)).toBe(0)
  })
})
