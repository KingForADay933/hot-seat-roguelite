import type { Player } from '../../data/types'
import { CLUTCH_BONUS_MAX, CLUTCH_POSSESSION_WINDOW_FRACTION, CLUTCH_SCORE_MARGIN, CONSISTENCY_NOISE_MAX } from '../constants'
import type { Rng } from '../rng'

function gaussianNoise(mean: number, stdDev: number, rng: Rng): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return mean + z * stdDev
}

/** Low-Consistency players swing further from their raw strength score, in either direction. */
export function computeConsistencyNoise(player: Player, rng: Rng): number {
  const stdDev = ((100 - player.hidden.consistency) / 100) * CONSISTENCY_NOISE_MAX
  return gaussianNoise(0, stdDev, rng)
}

export function isClutchTime(possessionNumber: number, totalPossessions: number, scoreMargin: number): boolean {
  const windowStart = totalPossessions * (1 - CLUTCH_POSSESSION_WINDOW_FRACTION)
  return possessionNumber >= windowStart && Math.abs(scoreMargin) <= CLUTCH_SCORE_MARGIN
}

/** Zero outside clutch time regardless of the player's Clutch rating. */
export function computeClutchBonus(player: Player, isClutch: boolean): number {
  if (!isClutch) return 0
  return ((player.hidden.clutch - 50) / 50) * CLUTCH_BONUS_MAX
}
