import { useCallback, useEffect, useRef, useState } from 'react'
import type { Game } from '../../data/types'
import type { SimulationStep } from '../../engine/simulateGame'
import { advancePlayback, createPlaybackState, type PlaybackContext, type PlaybackState } from './playbackState'

/** Multipliers on BASE_POSSESSION_MS. 1x runs a full game in about three minutes -- slow enough to
 *  read the play-by-play; 16x is closer to a highlight reel than a broadcast. */
export const PLAYBACK_SPEEDS = [1, 2, 4, 16] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

/** Halved when the clock doubled the possession count, so a broadcast still runs about as long in
 *  wall-clock terms as it did at ~100 possessions. */
const BASE_POSSESSION_MS = 450

export type PlaybackStatus = 'playing' | 'paused' | 'final'

export interface SimcastPlayback {
  state: PlaybackState
  status: PlaybackStatus
  /** The completed Game, available only once status is 'final' -- this is what gets committed. */
  finalGame: Game | null
  speed: PlaybackSpeed
  setSpeed: (speed: PlaybackSpeed) => void
  togglePause: () => void
  /** Plays out the rest of the game at once. The result is identical to letting the clock run --
   *  same possessions, same final score -- just without the wait. */
  skipToEnd: () => void
}

/**
 * Drives a game generator on a clock, folding each possession into playback state as it resolves.
 *
 * `createSteps` is called exactly once, on first render, and its generator is held in a ref for the
 * life of the screen. Generators don't run until first pulled, so building one during render is
 * inert -- nothing is simulated until the clock actually ticks. That laziness is the point: the
 * possessions past the cursor genuinely haven't happened yet, which is what leaves room for the GM
 * to change something mid-game later.
 */
export function useSimcastPlayback(context: PlaybackContext, createSteps: () => Generator<SimulationStep, Game>): SimcastPlayback {
  const stepsRef = useRef<Generator<SimulationStep, Game> | null>(null)
  if (stepsRef.current === null) stepsRef.current = createSteps()

  const [state, setState] = useState<PlaybackState>(() => createPlaybackState(context))
  const [status, setStatus] = useState<PlaybackStatus>('playing')
  const [finalGame, setFinalGame] = useState<Game | null>(null)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)

  useEffect(() => {
    if (status !== 'playing') return

    const steps = stepsRef.current
    if (!steps) return

    const id = setInterval(() => {
      const next = steps.next()
      if (next.done) {
        setFinalGame(next.value)
        setStatus('final')
        return
      }
      setState((prev) => advancePlayback(context, prev, next.value))
    }, BASE_POSSESSION_MS / speed)

    return () => clearInterval(id)
  }, [status, speed, context])

  const togglePause = useCallback(() => {
    setStatus((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev))
  }, [])

  const skipToEnd = useCallback(() => {
    const steps = stepsRef.current
    if (!steps) return

    // Drained here rather than inside the state updater: pulling from a generator mutates it, and
    // React is free to run an updater more than once.
    const remaining: SimulationStep[] = []
    let next = steps.next()
    while (!next.done) {
      remaining.push(next.value)
      next = steps.next()
    }

    setState((prev) => remaining.reduce((acc, step) => advancePlayback(context, acc, step), prev))
    setFinalGame(next.value)
    setStatus('final')
  }, [context])

  return { state, status, finalGame, speed, setSpeed, togglePause, skipToEnd }
}
