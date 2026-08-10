import { describe, expect, it } from 'vitest'
import { OFFENSIVE_PLAYBOOKS } from '../../data/presets'
import type { Player } from '../../data/types'
import { computeOffenseStrength } from '../../engine/possession/possessionStrength'
import type { PlaySelection } from '../../engine/possession/playerSelector'
import { generateLeague } from '../../engine/generator/randomLeague'
import { createSeededRng } from '../../engine/rng'
import { ALL_PLAY_CALLS, PLAY_CALL_MODELS } from './possessionRoles'

/**
 * PLAY_CALL_MODELS is a hand-written copy of engine/possession/possessionStrength.ts, and its own
 * doc comment says the two have to move together. Nothing enforced that, so they could -- and did --
 * drift silently: the system-fit number a GM is shown when picking a system is computed from this
 * copy, while the game they then play is resolved by the engine. A mismatch means the pitch and the
 * result disagree, with no test failing.
 *
 * This gives every play call the same players in both implementations and checks they agree. It only
 * covers the `contribution` half; `selectionScore` deliberately mirrors playerSelector.ts instead,
 * and the two are allowed to differ (the engine picks a transition outlet on rebounding but scores
 * the possession off the handler, for instance).
 */

/** A selection where every role is filled by the same player, so `contribution` summed over the
 *  model's roles must equal the engine's whole formula for that call. */
function uniformSelection(player: Player): PlaySelection {
  return {
    primary: player,
    secondaries: [player],
    primaryDefender: player,
    secondaryDefenders: [player],
    // Only isolation branches on this, and it does so via the player's own attributes rather than
    // this flag, so a fixed value is safe here.
    isOutsideShotAction: false,
  }
}

function mirrorStrength(playCall: (typeof ALL_PLAY_CALLS)[number], player: Player): number {
  return PLAY_CALL_MODELS[playCall].roles.reduce((sum, role) => sum + role.contribution(player), 0)
}

describe('the run-side strength mirror matches the engine', () => {
  const rng = createSeededRng(7)
  const { players } = generateLeague({ teamCount: 2, leagueName: 'Mirror', rng })
  // A neutral playbook: the engine multiplies three of the six calls by ballMovementModifier, which
  // is a property of the system rather than of the formula the mirror copies.
  const neutral = { ...OFFENSIVE_PLAYBOOKS[0], ballMovementModifier: 1 }

  for (const playCall of ALL_PLAY_CALLS) {
    it(`agrees on ${playCall}`, () => {
      for (const player of players.slice(0, 12)) {
        const engine = computeOffenseStrength(playCall, uniformSelection(player), neutral)
        expect(mirrorStrength(playCall, player)).toBeCloseTo(engine, 10)
      }
    })
  }
})
