import type { PlayCallType, PossessionOutcome } from '../../data/types'
import {
  NOMINAL_POSSESSION_SECONDS,
  POSSESSION_DURATION_BANDS,
  REBOUND_SECONDS,
  REGULATION_SECONDS,
  SECOND_CHANCE_DURATION_BAND,
  TURNOVER_DURATION_FACTOR,
} from '../constants'
import type { Rng } from '../rng'

/**
 * How much clock a possession burns.
 *
 * Pace is no longer a fixed loop bound -- the game runs until the clock expires, so how many
 * possessions a team gets is an *outcome* of how long its possessions take. That makes the playbook
 * a pace lever for free: a Seven Seconds Or Less mix leans on transition (4-9s) and gets more trips
 * than a Twin Towers mix leaning on post-ups (14-22s), without a separate pace rating existing.
 *
 * `league.pacePresets.possessionsPerGame` survives as the league-wide scale rather than a loop
 * bound: it says how many possessions a *neutral* playbook should produce, and every sampled
 * duration is stretched or compressed to hit it. A playbook that skews fast or slow then moves off
 * that number in the right direction.
 */
export function paceScale(possessionsPerGame: number): number {
  if (possessionsPerGame <= 0) return 1
  return REGULATION_SECONDS / possessionsPerGame / NOMINAL_POSSESSION_SECONDS
}

/**
 * Seconds taken by one resolved possession, before the caller clamps it to whatever is left on the
 * clock. Sampled from the play call's band, then adjusted by what actually happened:
 *
 *  - a turnover cuts the action short, since the ball is lost partway through it
 *  - a miss adds the rebound scramble before the other team has possession
 *  - a make is inbounded, and a foul stops the clock outright, so neither pays extra
 */
export function possessionDurationSeconds(
  playCall: PlayCallType,
  outcome: PossessionOutcome,
  possessionsPerGame: number,
  rng: Rng,
  isSecondChance = false,
): number {
  // A putback is a shot already under the rim, not a trip up the floor, so it ignores the play
  // call's band entirely -- otherwise second chances would cost a full possession of clock and
  // offensive rebounds would slow the game down instead of adding shots to it.
  const [min, max] = isSecondChance
    ? SECOND_CHANCE_DURATION_BAND
    : (POSSESSION_DURATION_BANDS[playCall] ?? [NOMINAL_POSSESSION_SECONDS, NOMINAL_POSSESSION_SECONDS])
  const sampled = min + rng() * (max - min)

  const adjusted =
    outcome === 'turnover' ? sampled * TURNOVER_DURATION_FACTOR : outcome === 'miss' ? sampled + REBOUND_SECONDS : sampled

  return adjusted * paceScale(possessionsPerGame)
}
