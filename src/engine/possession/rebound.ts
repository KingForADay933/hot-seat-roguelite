import type { Player } from '../../data/types'
import {
  OFFENSIVE_REBOUND_RATE,
  OFFENSIVE_REBOUND_SENSITIVITY,
  REBOUND_SIZE_WEIGHT,
  REBOUND_WEIGHT_EXPONENT,
} from '../constants'
import { average, clamp } from '../math'
import { avgInteriorDefense } from '../matchup'
import type { Rng } from '../rng'

function teamRebounding(five: Player[]): number {
  return five.length === 0 ? 0 : average(five.map((p) => p.attributes.rebounding))
}

/**
 * How often the shooting team recovers its own miss, given who is on the floor.
 *
 * Weighted by the two fives' Rebounding rather than flat, so the attribute decides possessions and
 * not just who gets the stat credited -- putting a glass-cleaning big out there genuinely buys extra
 * shots. Clamped so no lineup ever guarantees or forfeits the board.
 */
export function offensiveReboundProbability(offenseOnCourt: Player[], defenseOnCourt: Player[]): number {
  const edge = teamRebounding(offenseOnCourt) - teamRebounding(defenseOnCourt)
  return clamp(OFFENSIVE_REBOUND_RATE + edge / OFFENSIVE_REBOUND_SENSITIVITY, 0.05, 0.5)
}

/** A player's standing in the contest for a loose ball: Rebounding blended with size, since boxing
 *  out and finishing over someone is not purely a matter of the one attribute. */
export function reboundContestScore(player: Player): number {
  return (1 - REBOUND_SIZE_WEIGHT) * player.attributes.rebounding + REBOUND_SIZE_WEIGHT * avgInteriorDefense(player)
}

/**
 * Who came down with it, weighted within whichever five recovered the ball.
 *
 * Two things decide the split, and both were missing: the score blends size into Rebounding (see
 * reboundContestScore), and it is raised to REBOUND_WEIGHT_EXPONENT so the best rebounder on the
 * floor genuinely dominates the glass rather than edging it. A flat, attribute-only weighting had
 * centres taking boards only 1.46x as often as point guards, against a real ratio near 3.
 *
 * **Attribution only -- this cannot change a game's outcome.** Whether the offense keeps the ball is
 * decided by offensiveReboundProbability above, before this is called; this only names the player.
 * It also consumes exactly one rng() call however the weights fall, so the random stream every later
 * possession draws from is untouched and existing seeds still reproduce their games.
 */
export function pickRebounder(reboundingFive: Player[], rng: Rng): Player {
  const weights = reboundingFive.map((p) => Math.max(reboundContestScore(p), 0.01) ** REBOUND_WEIGHT_EXPONENT)
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = rng() * total
  for (let i = 0; i < reboundingFive.length; i++) {
    if (roll < weights[i]) return reboundingFive[i]
    roll -= weights[i]
  }
  return reboundingFive[reboundingFive.length - 1]
}
