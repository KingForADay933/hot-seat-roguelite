import type { OffensivePlaybook } from '../../data/presets'
import type { PlayCallType, Player } from '../../data/types'
import { average } from '../math'
import { POSSESSION_STRENGTH_WEIGHTS, TENDENCY_SHOT_SELECTION } from '../constants'
import type { PlaySelection } from './playerSelector'

/** Roughly a 0-100 scale offense score. Higher beats a higher defensive resistance more often. */
export function computeOffenseStrength(
  playCall: PlayCallType,
  selection: PlaySelection,
  playbook: OffensivePlaybook,
  offenseOnCourt: Player[],
): number {
  const w = POSSESSION_STRENGTH_WEIGHTS

  switch (playCall) {
    case 'pick-and-roll': {
      const handler = selection.primary
      const roller = selection.secondaries[0]
      const s =
        w.pickAndRoll.handlerBallHandling * handler.attributes.ballHandling +
        w.pickAndRoll.handlerPassing * handler.attributes.passing +
        w.pickAndRoll.rollerInsideShot * roller.attributes.insideShot +
        w.pickAndRoll.rollerVertical * roller.attributes.vertical
      return s * playbook.ballMovementModifier
    }
    case 'isolation': {
      const handler = selection.primary
      const shot = Math.max(handler.attributes.outsideShot, handler.attributes.insideShot)
      const shotSelection = TENDENCY_SHOT_SELECTION[handler.hidden.tendency]
      // Not scaled by ballMovementModifier -- iso-heavy playbooks get more Iso draws, not a strength bonus.
      return (
        w.isolation.ballHandling * handler.attributes.ballHandling +
        w.isolation.shot * shot +
        w.isolation.shotSelection * shotSelection
      )
    }
    case 'post-up': {
      const poster = selection.primary
      return w.postUp.insideShot * poster.attributes.insideShot + w.postUp.vertical * poster.attributes.vertical
    }
    case 'spot-up': {
      const shooter = selection.primary
      const creator = selection.secondaries[0]
      const s = w.spotUp.outsideShot * shooter.attributes.outsideShot + w.spotUp.creatorPassing * creator.attributes.passing
      return s * playbook.ballMovementModifier
    }
    case 'cutting': {
      const cutter = selection.primary
      const passer = selection.secondaries[0]
      const s =
        w.cutting.speed * cutter.attributes.speed +
        w.cutting.passingAvg * ((passer.attributes.passing + cutter.attributes.passing) / 2)
      return s * playbook.ballMovementModifier
    }
    case 'transition': {
      const handler = selection.primary
      const teamReboundingAvg = average(offenseOnCourt.map((p) => p.attributes.rebounding))
      return (
        w.transition.speed * handler.attributes.speed +
        w.transition.passing * handler.attributes.passing +
        w.transition.teamRebounding * teamReboundingAvg
      )
    }
  }
}
