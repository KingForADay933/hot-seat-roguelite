import type { PlayCallType, Player } from '../../data/types'
import { POSSESSION_STRENGTH_WEIGHTS, TENDENCY_SHOT_SELECTION } from '../../engine/constants'

/**
 * A structural mirror of how a possession actually resolves, used to score system fit.
 *
 * Every entry here has two halves, and both are copied from real engine code rather than invented:
 *
 *  - `selectionScore` mirrors the matching `score*` function in
 *    engine/possession/playerSelector.ts, which is what decides *who* executes the role. The
 *    engine picks with weight `selectionScore ^ USAGE_WEIGHT_EXPONENT`, so this is what determines
 *    touch distribution.
 *  - `contribution` mirrors that role's share of engine/possession/possessionStrength.ts's
 *    computeOffenseStrength formula for the play call, using the same POSSESSION_STRENGTH_WEIGHTS
 *    coefficients -- so it is literally the number of offense-strength points this role's player
 *    puts on the possession.
 *
 * Keeping these paired and sourced from the engine's own constants is the point: synergy is a
 * projection of what the simulation will actually do, so a play-by-play readout should never
 * contradict the fit number that sold the GM on the system. If either engine file changes, the
 * matching half here has to change with it.
 */
export interface PossessionRole {
  /** How the engine ranks candidates for this role (playerSelector.ts's score* functions). */
  selectionScore: (player: Player) => number
  /** Offense-strength points this role's executor contributes (possessionStrength.ts's weights). */
  contribution: (player: Player) => number
}

export interface PlayCallModel {
  roles: PossessionRole[]
}

const a = (player: Player) => player.attributes
const w = POSSESSION_STRENGTH_WEIGHTS

export const PLAY_CALL_MODELS: Record<PlayCallType, PlayCallModel> = {
  'pick-and-roll': {
    roles: [
      {
        selectionScore: (p) => (a(p).ballHandling + a(p).passing) / 2,
        contribution: (p) => w.pickAndRoll.handlerBallHandling * a(p).ballHandling + w.pickAndRoll.handlerPassing * a(p).passing,
      },
      {
        selectionScore: (p) => (a(p).insideShot + a(p).vertical) / 2,
        contribution: (p) => w.pickAndRoll.rollerInsideShot * a(p).insideShot + w.pickAndRoll.rollerVertical * a(p).vertical,
      },
    ],
  },
  isolation: {
    roles: [
      {
        selectionScore: (p) => (a(p).ballHandling + Math.max(a(p).outsideShot, a(p).insideShot)) / 2,
        // Tendency rides along here exactly as it does in the engine: a shoot-first iso handler
        // takes worse shots, so Iso-heavy systems genuinely prefer a pass-first creator.
        contribution: (p) =>
          w.isolation.ballHandling * a(p).ballHandling +
          w.isolation.shot * Math.max(a(p).outsideShot, a(p).insideShot) +
          w.isolation.shotSelection * TENDENCY_SHOT_SELECTION[p.hidden.tendency],
      },
    ],
  },
  'post-up': {
    roles: [
      {
        selectionScore: (p) => (a(p).insideShot + a(p).vertical) / 2,
        contribution: (p) => w.postUp.insideShot * a(p).insideShot + w.postUp.vertical * a(p).vertical,
      },
    ],
  },
  'spot-up': {
    roles: [
      { selectionScore: (p) => a(p).outsideShot, contribution: (p) => w.spotUp.outsideShot * a(p).outsideShot },
      { selectionScore: (p) => a(p).passing, contribution: (p) => w.spotUp.creatorPassing * a(p).passing },
    ],
  },
  cutting: {
    // Both the cutter and the passer are drawn on the same score in the engine, and the strength
    // formula averages their passing -- so the two roles split the passing term evenly, with the
    // cutter additionally carrying all of the speed term and all of the finishing term.
    roles: [
      {
        selectionScore: (p) => (a(p).passing + a(p).speed) / 2,
        contribution: (p) =>
          w.cutting.speed * a(p).speed + w.cutting.insideShot * a(p).insideShot + (w.cutting.passingAvg / 2) * a(p).passing,
      },
      {
        selectionScore: (p) => (a(p).passing + a(p).speed) / 2,
        contribution: (p) => (w.cutting.passingAvg / 2) * a(p).passing,
      },
    ],
  },
  transition: {
    // One role: the engine reads only the handler for strength. The outlet is still selected (on
    // rebounding, for attribution and commentary) but no longer contributes -- transition used to
    // add the on-court five's mean rebounding, which is why this interface once had a whole-roster
    // `teamRebounding` escape hatch. Dropping that term from the engine retired it.
    roles: [
      {
        selectionScore: (p) => (a(p).speed + a(p).passing) / 2,
        contribution: (p) =>
          w.transition.speed * a(p).speed + w.transition.passing * a(p).passing + w.transition.insideShot * a(p).insideShot,
      },
    ],
  },
}

export const ALL_PLAY_CALLS = Object.keys(PLAY_CALL_MODELS) as PlayCallType[]
