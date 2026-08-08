import type { Player } from '../../data/types'
import { OFFENSIVE_REBOUND_RATE, OFFENSIVE_REBOUND_SENSITIVITY } from '../constants'
import { average, clamp } from '../math'
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

/** Who came down with it. Weighted by Rebounding within whichever five recovered the ball. */
export function pickRebounder(reboundingFive: Player[], rng: Rng): Player {
  const total = reboundingFive.reduce((sum, p) => sum + p.attributes.rebounding, 0)
  let roll = rng() * total
  for (const player of reboundingFive) {
    if (roll < player.attributes.rebounding) return player
    roll -= player.attributes.rebounding
  }
  return reboundingFive[reboundingFive.length - 1]
}
