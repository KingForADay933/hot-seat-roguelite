import type { DefensiveScheme } from '../../data/presets'
import type { PlayCallType, Player } from '../../data/types'
import { average } from '../math'
import { PRESS_RESISTANCE_SCALE, RESISTANCE_WEIGHTS } from '../constants'
import type { PlaySelection } from './playerSelector'

/**
 * Pack-the-Paint boosts resistance on interior actions and lowers it on perimeter ones
 * ("forgiving of weak perimeter defenders"); Pick-and-Roll and Transition are treated as
 * neutral since their formulas already blend both defender types directly.
 */
function applyInteriorFocus(r: number, scheme: DefensiveScheme, flag: -1 | 0 | 1): number {
  if (flag === 0) return r
  return r * (1 + (scheme.interiorFocus - 0.5) * flag)
}

/** Backcourt ball-pressure term applied to every possession, scaled by the scheme's pressureCoefficient
 *  (Full-Court Press sets this far higher than other schemes). */
function computePressResistance(scheme: DefensiveScheme, offenseOnCourt: Player[], defenseOnCourt: Player[]): number {
  const defensePressure = average(defenseOnCourt.map((p) => (p.attributes.speed + p.attributes.lateralQuickness) / 2))
  const offenseHandling = average(offenseOnCourt.map((p) => (p.attributes.ballHandling + p.attributes.passing) / 2))
  return scheme.pressureCoefficient * (defensePressure - offenseHandling) * PRESS_RESISTANCE_SCALE
}

/** Roughly a 0-100 scale defense score, compared against offense strength to resolve the possession. */
export function computeResistance(
  playCall: PlayCallType,
  selection: PlaySelection,
  scheme: DefensiveScheme,
  offenseOnCourt: Player[],
  defenseOnCourt: Player[],
): number {
  const w = RESISTANCE_WEIGHTS
  let r: number

  switch (playCall) {
    case 'pick-and-roll': {
      const handlerDef = selection.primaryDefender
      const rollerDef = selection.secondaryDefenders[0]
      r =
        w.pickAndRoll.handlerLateral * handlerDef.attributes.lateralQuickness +
        w.pickAndRoll.handlerPerimeter * handlerDef.attributes.perimeterDefense +
        w.pickAndRoll.rollerInterior * rollerDef.attributes.interiorDefense
      break
    }
    case 'isolation': {
      const def = selection.primaryDefender
      r = selection.isOutsideShotAction
        ? w.isolationPerimeter.lateral * def.attributes.lateralQuickness +
          w.isolationPerimeter.perimeter * def.attributes.perimeterDefense
        : w.isolationInterior.interior * def.attributes.interiorDefense +
          w.isolationInterior.vertical * def.attributes.vertical
      r = applyInteriorFocus(r, scheme, selection.isOutsideShotAction ? -1 : 1)
      break
    }
    case 'post-up': {
      const def = selection.primaryDefender
      r = w.postUp.interior * def.attributes.interiorDefense + w.postUp.vertical * def.attributes.vertical
      r = applyInteriorFocus(r, scheme, 1)
      break
    }
    case 'spot-up': {
      r = selection.primaryDefender.attributes.perimeterDefense
      r = applyInteriorFocus(r, scheme, -1)
      break
    }
    case 'cutting': {
      r = selection.primaryDefender.attributes.lateralQuickness
      r = applyInteriorFocus(r, scheme, -1)
      break
    }
    case 'transition': {
      const def = selection.primaryDefender
      r = w.transition.speed * def.attributes.speed + w.transition.lateral * def.attributes.lateralQuickness
      break
    }
  }

  return r + computePressResistance(scheme, offenseOnCourt, defenseOnCourt)
}
