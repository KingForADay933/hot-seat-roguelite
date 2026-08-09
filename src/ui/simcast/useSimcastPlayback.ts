import { useCallback, useEffect, useRef, useState } from 'react'
import type { Game } from '../../data/types'
import type { SimulationStep } from '../../engine/simulateGame'
import { advancePlayback, createPlaybackState, entersNewOvertimePeriod, type PlaybackContext, type PlaybackState } from './playbackState'

/**
 * Multipliers on BASE_POSSESSION_MS -- ascending, so the control row reads slowest-to-fastest.
 *
 * Against a measured ~219 possessions a game: 0.75x runs about 4m20s, 1x about 3m20s, 2x about
 * 1m40s, 4x about 50s, and 16x about 12 seconds -- closer to a highlight reel than a broadcast.
 *
 * 0.75x exists because 1x is the reading speed for the play-by-play and some possessions (a long
 * commentary line, a scramble for an offensive rebound) want a beat longer than that.
 */
export const PLAYBACK_SPEEDS = [0.75, 1, 2, 4, 16] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

/**
 * Wall-clock milliseconds per possession at 1x.
 *
 * Briefly 450, halved from this value when the clock rewrite doubled the possession count on the
 * theory that a broadcast should stay the same length in wall-clock terms. In practice that made
 * 1x too fast to read -- a full game went by in about 100 seconds, and the comment above still
 * claimed three minutes because it was written against the pre-halving value. Restored, so 1x is
 * paced for reading the play-by-play rather than for finishing quickly; anyone who wants the old
 * speed has 2x, which is exactly what 1x used to be.
 */
const BASE_POSSESSION_MS = 900

export type PlaybackStatus = 'playing' | 'paused' | 'awaiting-substitutions' | 'final'

export interface SimcastPlayback {
  state: PlaybackState
  status: PlaybackStatus
  /** The completed Game, available only once status is 'final' -- this is what gets committed. */
  finalGame: Game | null
  speed: PlaybackSpeed
  setSpeed: (speed: PlaybackSpeed) => void
  togglePause: () => void
  /** Plays out the rest of the game at once. The result is identical to letting the clock run --
   *  same possessions, same final score -- just without the wait -- and bypasses any pending
   *  'awaiting-substitutions' prompt rather than deadlocking against it. */
  skipToEnd: () => void
  /** Dismisses the 'awaiting-substitutions' prompt and resumes playback, folding in the overtime
   *  possession that triggered it (rotation-charts.md Decision 5/Phase H). A no-op in any other
   *  status. */
  acknowledgeOvertimePrompt: () => void
}

/**
 * Drives a game generator on a clock, folding each possession into playback state as it resolves.
 *
 * `createSteps` is called exactly once, on first render, and its generator is held in a ref for the
 * life of the screen. Generators don't run until first pulled, so building one during render is
 * inert -- nothing is simulated until the clock actually ticks. That laziness is the point: the
 * possessions past the cursor genuinely haven't happened yet, which is what leaves room for the GM
 * to change something mid-game later.
 *
 * Decision 5 ("the normal sim carries the Q4 closing five; the simcast prompts for substitutions at
 * the start of each overtime period") is implemented as a genuine pause-and-acknowledge moment, not
 * a live lineup editor: when the pulled step is the first of a new overtime period, it's held in
 * `pendingStepRef` rather than folded into state immediately, and status becomes
 * 'awaiting-substitutions' -- which stops the interval the same way 'paused' does, below.
 * `acknowledgeOvertimePrompt` folds the held step in and resumes. Actually editing the on-court five
 * from this pause isn't wired up: the closing five carries over automatically either way (that's
 * Decision 5's default, already true because RotationState persists across periods unchanged), so
 * the prompt's job is to give the GM a beat to notice overtime started, not to block on a decision
 * the sim can't make progress without.
 */
export function useSimcastPlayback(context: PlaybackContext, createSteps: () => Generator<SimulationStep, Game>): SimcastPlayback {
  const stepsRef = useRef<Generator<SimulationStep, Game> | null>(null)
  if (stepsRef.current === null) stepsRef.current = createSteps()
  // Mirrors state.period without being subject to its staleness -- the interval callback below
  // closes over one render's `state`, but a ref's `.current` is always the latest write.
  const periodRef = useRef(1)
  // A step already pulled from the generator (so it can't be pulled again) but not yet folded into
  // state, because it was the first possession of an overtime period and the prompt is up.
  const pendingStepRef = useRef<SimulationStep | null>(null)

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
      if (entersNewOvertimePeriod(periodRef.current, next.value.entry.period)) {
        pendingStepRef.current = next.value
        setStatus('awaiting-substitutions')
        return
      }
      periodRef.current = next.value.entry.period
      setState((prev) => advancePlayback(context, prev, next.value))
    }, BASE_POSSESSION_MS / speed)

    return () => clearInterval(id)
  }, [status, speed, context])

  const togglePause = useCallback(() => {
    setStatus((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev))
  }, [])

  const acknowledgeOvertimePrompt = useCallback(() => {
    const pending = pendingStepRef.current
    if (pending) {
      periodRef.current = pending.entry.period
      setState((prev) => advancePlayback(context, prev, pending))
      pendingStepRef.current = null
    }
    setStatus((prev) => (prev === 'awaiting-substitutions' ? 'playing' : prev))
  }, [context])

  const skipToEnd = useCallback(() => {
    const steps = stepsRef.current
    if (!steps) return

    // Drained here rather than inside the state updater: pulling from a generator mutates it, and
    // React is free to run an updater more than once.
    const remaining: SimulationStep[] = []
    if (pendingStepRef.current) {
      remaining.push(pendingStepRef.current)
      pendingStepRef.current = null
    }
    let next = steps.next()
    while (!next.done) {
      remaining.push(next.value)
      next = steps.next()
    }

    setState((prev) => remaining.reduce((acc, step) => advancePlayback(context, acc, step), prev))
    if (remaining.length > 0) periodRef.current = remaining[remaining.length - 1].entry.period
    setFinalGame(next.value)
    setStatus('final')
  }, [context])

  return { state, status, finalGame, speed, setSpeed, togglePause, skipToEnd, acknowledgeOvertimePrompt }
}
