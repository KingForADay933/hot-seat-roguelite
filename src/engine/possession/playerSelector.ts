import type { DefensiveScheme } from '../../data/presets'
import type { PlayCallType, Player, PlayerId } from '../../data/types'
import { USAGE_WEIGHT_EXPONENT } from '../constants'
import { avgInteriorDefense, avgPerimeterDefense, buildMatchups, playersOf, type OnCourtPlayer } from '../matchup'
import type { Rng } from '../rng'

export interface PlaySelection {
  primary: Player
  secondaries: Player[]
  primaryDefender: Player
  secondaryDefenders: Player[]
  /** True for plays whose points-on-make and resistance branch are driven by the outside shot. */
  isOutsideShotAction: boolean
}

/**
 * Spreads offensive usage across the on-court five instead of always handing the ball to the
 * single best fit: each candidate's weight is fitScore^USAGE_WEIGHT_EXPONENT, so the best-fit
 * player is still picked most often but everyone has a real chance. See constants.ts for the
 * concentration knob -- a placeholder for a future per-player usage-rate system.
 */
function pickWeighted(players: Player[], score: (p: Player) => number, rng: Rng): Player {
  const weights = players.map((p) => Math.max(score(p), 0.01) ** USAGE_WEIGHT_EXPONENT)
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = rng() * total
  for (let i = 0; i < players.length; i++) {
    if (roll < weights[i]) return players[i]
    roll -= weights[i]
  }
  return players[players.length - 1]
}

/** Switch-Everything: the whole roster's weakest link matters, not the assigned matchup. */
export function worstPerimeterDefender(defense: Player[]): Player {
  return defense.reduce((worst, p) => (avgPerimeterDefense(p) < avgPerimeterDefense(worst) ? p : worst))
}
export function worstInteriorDefender(defense: Player[]): Player {
  return defense.reduce((worst, p) => (avgInteriorDefense(p) < avgInteriorDefense(worst) ? p : worst))
}

const scoreHandler = (p: Player) => (p.attributes.ballHandling + p.attributes.passing) / 2
const scoreInsideBig = (p: Player) => (p.attributes.insideShot + p.attributes.vertical) / 2
const scoreIsoHandler = (p: Player) =>
  (p.attributes.ballHandling + Math.max(p.attributes.outsideShot, p.attributes.insideShot)) / 2
const scoreShooter = (p: Player) => p.attributes.outsideShot
const scorePasser = (p: Player) => p.attributes.passing
const scoreCutter = (p: Player) => (p.attributes.passing + p.attributes.speed) / 2
const scoreTransitionHandler = (p: Player) => (p.attributes.speed + p.attributes.passing) / 2
const scoreRebounder = (p: Player) => p.attributes.rebounding

/**
 * Takes slot-assigned fives because defender assignment pairs on slots, but scores candidates on
 * the plain players -- who executes a play call is about ability, not where they're standing.
 */
export function selectPlayers(
  playCall: PlayCallType,
  offenseFive: OnCourtPlayer[],
  defenseFive: OnCourtPlayer[],
  scheme: DefensiveScheme,
  rng: Rng,
): PlaySelection {
  const offense = playersOf(offenseFive)
  const defense = playersOf(defenseFive)
  const matchups = buildMatchups(offenseFive, defenseFive)
  const assignedDefenderOf = (p: Player) => matchups.get(p.id) ?? defense[0]

  switch (playCall) {
    case 'pick-and-roll': {
      const handler = pickWeighted(offense, scoreHandler, rng)
      const roller = pickWeighted(
        offense.filter((p) => p !== handler),
        scoreInsideBig,
        rng,
      )
      return {
        primary: handler,
        secondaries: [roller],
        primaryDefender: scheme.weakLinkSensitive ? worstPerimeterDefender(defense) : assignedDefenderOf(handler),
        secondaryDefenders: [scheme.weakLinkSensitive ? worstInteriorDefender(defense) : assignedDefenderOf(roller)],
        isOutsideShotAction: false,
      }
    }
    case 'isolation': {
      const handler = pickWeighted(offense, scoreIsoHandler, rng)
      const isOutside = handler.attributes.outsideShot > handler.attributes.insideShot
      const defender = scheme.weakLinkSensitive
        ? isOutside
          ? worstPerimeterDefender(defense)
          : worstInteriorDefender(defense)
        : assignedDefenderOf(handler)
      return {
        primary: handler,
        secondaries: [],
        primaryDefender: defender,
        secondaryDefenders: [],
        isOutsideShotAction: isOutside,
      }
    }
    case 'post-up': {
      const poster = pickWeighted(offense, scoreInsideBig, rng)
      return {
        primary: poster,
        secondaries: [],
        primaryDefender: scheme.weakLinkSensitive ? worstInteriorDefender(defense) : assignedDefenderOf(poster),
        secondaryDefenders: [],
        isOutsideShotAction: false,
      }
    }
    case 'spot-up': {
      const shooter = pickWeighted(offense, scoreShooter, rng)
      const creator = pickWeighted(
        offense.filter((p) => p !== shooter),
        scorePasser,
        rng,
      )
      return {
        primary: shooter,
        secondaries: [creator],
        primaryDefender: scheme.weakLinkSensitive ? worstPerimeterDefender(defense) : assignedDefenderOf(shooter),
        secondaryDefenders: [],
        isOutsideShotAction: true,
      }
    }
    case 'cutting': {
      const cutter = pickWeighted(offense, scoreCutter, rng)
      const passer = pickWeighted(
        offense.filter((p) => p !== cutter),
        scoreCutter,
        rng,
      )
      return {
        primary: cutter,
        secondaries: [passer],
        primaryDefender: scheme.weakLinkSensitive ? worstPerimeterDefender(defense) : assignedDefenderOf(cutter),
        secondaryDefenders: [],
        isOutsideShotAction: false,
      }
    }
    case 'transition': {
      const handler = pickWeighted(offense, scoreTransitionHandler, rng)
      const outlet = pickWeighted(
        offense.filter((p) => p !== handler),
        scoreRebounder,
        rng,
      )
      return {
        primary: handler,
        secondaries: [outlet],
        // The assigned matchup, like every other play call. This used to be pickBest(defense,
        // scoreSpeed) -- a fast break faced the fastest defender on the floor, deterministically,
        // making transition the one play call always defended by the opponent's best option at it.
        // That is backwards: a break is a break precisely because the defense is *not* set, and it
        // was most of why transition was the engine's least efficient call.
        primaryDefender: assignedDefenderOf(handler),
        secondaryDefenders: [],
        isOutsideShotAction: false,
      }
    }
  }
}

export function getInvolvedPlayerIds(selection: PlaySelection): PlayerId[] {
  const ids = new Set<PlayerId>()
  ids.add(selection.primary.id)
  selection.secondaries.forEach((p) => ids.add(p.id))
  ids.add(selection.primaryDefender.id)
  selection.secondaryDefenders.forEach((p) => ids.add(p.id))
  return [...ids]
}
