import type { PlayCallType, Player, PossessionOutcome } from '../../data/types'
import { clamp } from '../math'
import {
  ATTRIBUTE_CEILING,
  ATTRIBUTE_FLOOR,
  CLUTCH_BONUS_MAX,
  FOUL_PROB_BASE,
  FOUL_PROB_INTERIOR_BONUS,
  FREE_THROWS_ON_THREE,
  FREE_THROWS_ON_TWO,
  FREE_THROW_PROB_MAX,
  FREE_THROW_PROB_MIN,
  MAKE_PROB_BASE,
  MAKE_PROB_MARGIN_SCALE,
  MAKE_PROB_MAX,
  MAKE_PROB_MIN,
  THREE_POINT_MAKE_PENALTY,
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
  pointsScored: number
  freeThrowsMade: number
  freeThrowsAttempted: number
}

/**
 * A shooter's free-throw percentage: Outside Shot mapped across the narrow, high band real free
 * throws occupy (see FREE_THROW_PROB_*), nudged by Clutch in crunch time.
 *
 * Clutch applies here and not just to field goals because the free throw is the shot where nerve is
 * most of what's left -- nobody is contesting it. The bonus is on the same attribute-point scale
 * computeClutchBonus returns for offense strength, so it's rescaled by CLUTCH_BONUS_MAX into a
 * fraction of the probability band rather than added raw.
 */
export function freeThrowProbability(shooter: Player, isClutch: boolean): number {
  const skill = (shooter.attributes.outsideShot - ATTRIBUTE_FLOOR) / (ATTRIBUTE_CEILING - ATTRIBUTE_FLOOR)
  const base = FREE_THROW_PROB_MIN + skill * (FREE_THROW_PROB_MAX - FREE_THROW_PROB_MIN)
  const clutchShift = (computeClutchBonus(shooter, isClutch) / CLUTCH_BONUS_MAX) * (FREE_THROW_PROB_MAX - FREE_THROW_PROB_MIN)
  return clamp(base + clutchShift, 0, 1)
}

/** Shoots the awarded free throws one at a time, each an independent roll. */
function shootFreeThrows(shooter: Player, attempts: number, isClutch: boolean, rng: Rng): number {
  const probability = freeThrowProbability(shooter, isClutch)
  let made = 0
  for (let i = 0; i < attempts; i++) if (rng() < probability) made += 1
  return made
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
  clockSecondsRemaining: number,
  isFinalPeriod: boolean,
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
    return { outcome: 'turnover', pointsScored: 0, freeThrowsMade: 0, freeThrowsAttempted: 0 }
  }

  const isClutch = isClutchTime(clockSecondsRemaining, isFinalPeriod, scoreMargin)
  const netStrength = strength + computeConsistencyNoise(primary, rng) + computeClutchBonus(primary, isClutch)
  const margin = netStrength - resistance
  // A three is harder than a two of the same quality -- that difficulty is what the extra point pays
  // for. Applied to the base rather than the margin so a player's shot-making still moves it the
  // same way; it shifts the whole curve down for outside attempts instead of flattening it.
  const base = MAKE_PROB_BASE - (selection.isOutsideShotAction ? THREE_POINT_MAKE_PENALTY : 0)
  const makeProb = clamp(base + margin / MAKE_PROB_MARGIN_SCALE, MAKE_PROB_MIN, MAKE_PROB_MAX)

  if (rng() < makeProb) {
    return {
      outcome: 'make',
      pointsScored: selection.isOutsideShotAction ? 3 : 2,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
    }
  }

  const foulProb =
    FOUL_PROB_BASE + (playCall === 'post-up' || playCall === 'pick-and-roll' ? FOUL_PROB_INTERIOR_BONUS : 0)
  if (rng() < foulProb) {
    // A shooting foul sends the shooter to the line rather than ending the possession empty. Before
    // this existed a drawn foul scored zero, which made contact strictly worse for the offense than
    // a plain miss -- and taxed exactly the interior play calls FOUL_PROB_INTERIOR_BONUS makes more
    // foul-prone, so post-heavy systems were quietly penalised for playing to their strength.
    const attempts = selection.isOutsideShotAction ? FREE_THROWS_ON_THREE : FREE_THROWS_ON_TWO
    const made = shootFreeThrows(primary, attempts, isClutch, rng)
    return { outcome: 'foul', pointsScored: made, freeThrowsMade: made, freeThrowsAttempted: attempts }
  }

  return { outcome: 'miss', pointsScored: 0, freeThrowsMade: 0, freeThrowsAttempted: 0 }
}
