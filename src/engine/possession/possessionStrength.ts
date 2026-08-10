import type { OffensivePlaybook } from '../../data/presets'
import type { PlayCallType } from '../../data/types'
import { clamp } from '../math'
import {
  POSSESSION_STRENGTH_WEIGHTS,
  SYNERGY_MULTIPLIER_FACTOR,
  SYNERGY_MULTIPLIER_MAX,
  SYNERGY_MULTIPLIER_MIN,
  SYNERGY_NEUTRAL,
  TENDENCY_SHOT_SELECTION,
} from '../constants'
import type { PlaySelection } from './playerSelector'

/** Converts a team's Team.synergyScore into the small offense-strength multiplier
 *  computeOffenseStrength applies -- 1.0 at SYNERGY_NEUTRAL, clamped to a modest +-10% swing so a
 *  drafted system's roster fit nudges games rather than deciding them outright. */
export function synergyMultiplier(synergyScore: number): number {
  return clamp(1 + (synergyScore - SYNERGY_NEUTRAL) * SYNERGY_MULTIPLIER_FACTOR, SYNERGY_MULTIPLIER_MIN, SYNERGY_MULTIPLIER_MAX)
}

/**
 * Roughly a 0-100 scale offense score. Higher beats a higher defensive resistance more often.
 * `offenseMultiplier` defaults to a neutral 1 so every existing call site is unaffected. It carries
 * two things that both scale the whole possession: the roster's fit to its drafted system
 * (synergyMultiplier above) and the efficiency half of the pace dial (engine/tacticalFocus.ts's
 * focusPaceEfficiency -- rushed looks are worse looks). Named for what it does rather than for
 * either contributor, since it stopped being only synergy when focus points landed.
 */
export function computeOffenseStrength(
  playCall: PlayCallType,
  selection: PlaySelection,
  playbook: OffensivePlaybook,
  offenseMultiplier: number = 1,
): number {
  const w = POSSESSION_STRENGTH_WEIGHTS
  let raw: number

  switch (playCall) {
    case 'pick-and-roll': {
      const handler = selection.primary
      const roller = selection.secondaries[0]
      const s =
        w.pickAndRoll.handlerBallHandling * handler.attributes.ballHandling +
        w.pickAndRoll.handlerPassing * handler.attributes.passing +
        w.pickAndRoll.rollerInsideShot * roller.attributes.insideShot +
        w.pickAndRoll.rollerVertical * roller.attributes.vertical
      raw = s * playbook.ballMovementModifier
      break
    }
    case 'isolation': {
      const handler = selection.primary
      const shot = Math.max(handler.attributes.outsideShot, handler.attributes.insideShot)
      const shotSelection = TENDENCY_SHOT_SELECTION[handler.hidden.tendency]
      // Not scaled by ballMovementModifier -- iso-heavy playbooks get more Iso draws, not a strength bonus.
      raw =
        w.isolation.ballHandling * handler.attributes.ballHandling +
        w.isolation.shot * shot +
        w.isolation.shotSelection * shotSelection
      break
    }
    case 'post-up': {
      const poster = selection.primary
      raw = w.postUp.insideShot * poster.attributes.insideShot + w.postUp.vertical * poster.attributes.vertical
      break
    }
    case 'spot-up': {
      const shooter = selection.primary
      const creator = selection.secondaries[0]
      const s = w.spotUp.outsideShot * shooter.attributes.outsideShot + w.spotUp.creatorPassing * creator.attributes.passing
      raw = s * playbook.ballMovementModifier
      break
    }
    case 'cutting': {
      const cutter = selection.primary
      const passer = selection.secondaries[0]
      const s =
        w.cutting.speed * cutter.attributes.speed +
        // The cut is finished by the cutter at the rim -- see POSSESSION_STRENGTH_WEIGHTS.
        w.cutting.insideShot * cutter.attributes.insideShot +
        w.cutting.passingAvg * ((passer.attributes.passing + cutter.attributes.passing) / 2)
      raw = s * playbook.ballMovementModifier
      break
    }
    case 'transition': {
      const handler = selection.primary
      raw =
        w.transition.speed * handler.attributes.speed +
        w.transition.passing * handler.attributes.passing +
        w.transition.insideShot * handler.attributes.insideShot
      break
    }
  }

  return raw * offenseMultiplier
}
