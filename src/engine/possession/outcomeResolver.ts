import type { PlayCallType, Player, PlayerId, PossessionOutcome } from '../../data/types'
import { clamp } from '../math'
import {
  ATTRIBUTE_CEILING,
  ATTRIBUTE_FLOOR,
  BLOCK_SHARE_INTERIOR,
  BLOCK_SHARE_MAX,
  BLOCK_SHARE_MIN,
  BLOCK_SHARE_OUTSIDE,
  BLOCK_SHARE_SENSITIVITY,
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
  STEAL_SHARE_BASE,
  STEAL_SHARE_MAX,
  STEAL_SHARE_MIN,
  STEAL_SHARE_SENSITIVITY,
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
  /** The defender who stripped it, on a turnover that was a live-ball steal rather than an unforced
   *  error. Null on every other outcome, and on turnovers nobody forced. */
  stolenById: PlayerId | null
  /** The defender who blocked it, on a miss that was blocked. Null otherwise. A blocked shot is
   *  still a miss -- same field-goal attempt, same rebound -- so this is credit, not a new branch. */
  blockedById: PlayerId | null
}

/** Rim protection, on the same interior pair positionFit treats as one. */
const rimProtection = (p: Player) => (p.attributes.interiorDefense + p.attributes.vertical) / 2

/** Ball pressure, matching the term the turnover probability itself is built from. */
const ballPressure = (p: Player) => (p.attributes.lateralQuickness + p.attributes.perimeterDefense) / 2

/**
 * Whether a turnover that already happened was forced by the defender, and so credited as a steal.
 *
 * Split out from the turnover roll rather than folded into it because the two answer different
 * questions: how often the offense coughs it up (already tuned, and unchanged here) versus who gets
 * the credit when they do. Keeping them separate means adding steals can't move turnover rates.
 */
export function stealShare(handler: Player, defender: Player): number {
  const pressureEdge = ballPressure(defender) - handler.attributes.ballHandling
  return clamp(STEAL_SHARE_BASE + pressureEdge / STEAL_SHARE_SENSITIVITY, STEAL_SHARE_MIN, STEAL_SHARE_MAX)
}

/**
 * Whether a miss that already happened was blocked. Conditioned on the shot being interior, since
 * blocks are overwhelmingly a paint event, and on the defender's rim protection against whatever
 * the shooter was actually trying to do.
 *
 * Measured against the shooter rather than an absolute baseline, mirroring stealShare: a shot-blocker
 * gets more of them against a poor finisher than against someone who can go up through contact.
 *
 * Same separation as stealShare too -- the make/miss roll is untouched, so shot quality and block
 * credit can be tuned independently.
 */
export function blockShare(shooter: Player, defender: Player, isOutsideShotAction: boolean): number {
  const base = isOutsideShotAction ? BLOCK_SHARE_OUTSIDE : BLOCK_SHARE_INTERIOR
  const shotSkill = isOutsideShotAction ? shooter.attributes.outsideShot : shooter.attributes.insideShot
  const protectionEdge = rimProtection(defender) - shotSkill
  return clamp(base + protectionEdge / BLOCK_SHARE_SENSITIVITY, BLOCK_SHARE_MIN, BLOCK_SHARE_MAX)
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
    // Forced or unforced. The roll above already decided the possession is lost; this only decides
    // whether a defender gets credit for it, so turnover rates are untouched by steals existing.
    const stolen = rng() < stealShare(primary, selection.primaryDefender)
    return {
      outcome: 'turnover',
      pointsScored: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      stolenById: stolen ? selection.primaryDefender.id : null,
      blockedById: null,
    }
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
      stolenById: null,
      blockedById: null,
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
    return { outcome: 'foul', pointsScored: made, freeThrowsMade: made, freeThrowsAttempted: attempts, stolenById: null, blockedById: null }
  }

  // Blocked or not. Same as the steal branch: the shot has already missed, so this decides credit
  // rather than the outcome -- the field-goal attempt and the rebound that follows are unchanged.
  const blocked = rng() < blockShare(primary, selection.primaryDefender, selection.isOutsideShotAction)
  return {
    outcome: 'miss',
    pointsScored: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    stolenById: null,
    blockedById: blocked ? selection.primaryDefender.id : null,
  }
}
