import type { Player } from '../../data/types'
import { CLUTCH_BONUS_MAX, CLUTCH_SCORE_MARGIN, CLUTCH_SECONDS_REMAINING, CONSISTENCY_NOISE_MAX } from '../constants'
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

/**
 * The last five minutes of the final period with the score inside five -- the NBA's own clutch
 * definition, now that there's a real clock to read it off. `isFinalPeriod` is what keeps a tight
 * end of Q1 from counting; every overtime period qualifies, since the whole five minutes of one
 * sits inside the window.
 */
export function isClutchTime(clockSecondsRemaining: number, isFinalPeriod: boolean, scoreMargin: number): boolean {
  if (!isFinalPeriod) return false
  return clockSecondsRemaining <= CLUTCH_SECONDS_REMAINING && Math.abs(scoreMargin) <= CLUTCH_SCORE_MARGIN
}

/** Zero outside clutch time regardless of the player's Clutch rating. */
export function computeClutchBonus(player: Player, isClutch: boolean): number {
  if (!isClutch) return 0
  return ((player.hidden.clutch - 50) / 50) * CLUTCH_BONUS_MAX
}
