import type { Player } from '../../data/types'
import {
  DURABILITY_NEUTRAL,
  FATIGUE_DURABILITY_FACTOR,
  FATIGUE_GAIN_BASE,
  FATIGUE_MULT_MAX,
  FATIGUE_MULT_MIN,
  FATIGUE_RECOVERY_BASE,
} from '../constants'
import { clamp } from '../math'
import type { RotationState } from './rotationState'

export function fatigueGainPerPossession(player: Player): number {
  const mult = clamp(
    1 - (player.hidden.durability - DURABILITY_NEUTRAL) * FATIGUE_DURABILITY_FACTOR,
    FATIGUE_MULT_MIN,
    FATIGUE_MULT_MAX,
  )
  return FATIGUE_GAIN_BASE * mult
}

export function fatigueRecoveryPerPossession(player: Player): number {
  const mult = clamp(
    1 + (player.hidden.durability - DURABILITY_NEUTRAL) * FATIGUE_DURABILITY_FACTOR,
    FATIGUE_MULT_MIN,
    FATIGUE_MULT_MAX,
  )
  return FATIGUE_RECOVERY_BASE * mult
}

/**
 * One possession's worth of fatigue: gain (+ possessionsPlayed increment) for state.onCourt,
 * recovery for the rest of the roster. Mutates state's maps in place.
 */
export function tickFatigue(state: RotationState, rosterPlayers: Player[]): void {
  const onCourtIds = new Set(state.onCourt.map((p) => p.id))

  rosterPlayers.forEach((player) => {
    const current = state.fatigue.get(player.id) ?? 0
    if (onCourtIds.has(player.id)) {
      state.fatigue.set(player.id, clamp(current + fatigueGainPerPossession(player), 0, 100))
      state.possessionsPlayed.set(player.id, (state.possessionsPlayed.get(player.id) ?? 0) + 1)
    } else {
      state.fatigue.set(player.id, clamp(current - fatigueRecoveryPerPossession(player), 0, 100))
    }
  })
}
