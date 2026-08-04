import type { PlayCallType, PossessionOutcome } from '../../data/types'
import { clamp } from '../math'
import {
  FOUL_PROB_BASE,
  FOUL_PROB_INTERIOR_BONUS,
  MAKE_PROB_BASE,
  MAKE_PROB_MARGIN_SCALE,
  MAKE_PROB_MAX,
  MAKE_PROB_MIN,
  TURNOVER_BASE_PROB,
  TURNOVER_MAX,
  TURNOVER_MIN,
  TURNOVER_SENSITIVITY,
} from '../constants'
import type { Rng } from '../rng'
import type { PlaySelection } from './playerSelector'
import { computeClutchBonus, computeConsistencyNoise, isClutchTime } from './variance'

export interface ResolvedPossession {
  outcome: PossessionOutcome
  pointsScored: 0 | 2 | 3
}

/**
 * Turnovers are checked before any shot is attempted -- a turnover possession never also
 * rolls a make/miss/foul, matching a real live-ball turnover happening before a shot goes up.
 */
export function resolvePossession(
  playCall: PlayCallType,
  selection: PlaySelection,
  strength: number,
  resistance: number,
  possessionNumber: number,
  totalPossessions: number,
  scoreMargin: number,
  rng: Rng,
): ResolvedPossession {
  const primary = selection.primary
  const defenderPressure =
    (selection.primaryDefender.attributes.lateralQuickness + selection.primaryDefender.attributes.perimeterDefense) / 2
  const turnoverProb = clamp(
    TURNOVER_BASE_PROB - (primary.attributes.ballHandling - defenderPressure) / TURNOVER_SENSITIVITY,
    TURNOVER_MIN,
    TURNOVER_MAX,
  )
  if (rng() < turnoverProb) {
    return { outcome: 'turnover', pointsScored: 0 }
  }

  const isClutch = isClutchTime(possessionNumber, totalPossessions, scoreMargin)
  const netStrength = strength + computeConsistencyNoise(primary, rng) + computeClutchBonus(primary, isClutch)
  const margin = netStrength - resistance
  const makeProb = clamp(MAKE_PROB_BASE + margin / MAKE_PROB_MARGIN_SCALE, MAKE_PROB_MIN, MAKE_PROB_MAX)

  if (rng() < makeProb) {
    return { outcome: 'make', pointsScored: selection.isOutsideShotAction ? 3 : 2 }
  }

  const foulProb =
    FOUL_PROB_BASE + (playCall === 'post-up' || playCall === 'pick-and-roll' ? FOUL_PROB_INTERIOR_BONUS : 0)
  if (rng() < foulProb) {
    return { outcome: 'foul', pointsScored: 0 }
  }

  return { outcome: 'miss', pointsScored: 0 }
}
