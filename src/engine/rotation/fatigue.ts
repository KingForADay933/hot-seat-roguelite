import type { Player } from '../../data/types'
import {
  DURABILITY_NEUTRAL,
  FATIGUE_DURABILITY_FACTOR,
  FATIGUE_GAIN_PER_SECOND,
  FATIGUE_MULT_MAX,
  FATIGUE_MULT_MIN,
  FATIGUE_RECOVERY_PER_SECOND,
} from '../constants'
import { clamp } from '../math'
import type { RotationState } from './rotationState'

export function fatigueGainPerSecond(player: Player): number {
  const mult = clamp(
    1 - (player.hidden.durability - DURABILITY_NEUTRAL) * FATIGUE_DURABILITY_FACTOR,
    FATIGUE_MULT_MIN,
    FATIGUE_MULT_MAX,
  )
  return FATIGUE_GAIN_PER_SECOND * mult
}

export function fatigueRecoveryPerSecond(player: Player): number {
  const mult = clamp(
    1 + (player.hidden.durability - DURABILITY_NEUTRAL) * FATIGUE_DURABILITY_FACTOR,
    FATIGUE_MULT_MIN,
    FATIGUE_MULT_MAX,
  )
  return FATIGUE_RECOVERY_PER_SECOND * mult
}

/**
 * One possession's worth of fatigue, scaled by how long that possession actually took: gain
 * (+ secondsPlayed) for state.onCourt, recovery for the rest of the roster. Mutates state's maps
 * in place.
 *
 * Taking the duration as an argument is what keeps a fast break from tiring a player as much as a
 * ground-out post-up -- under the old per-possession rates every trip cost the same regardless of
 * how much clock it burned.
 */
export function tickFatigue(state: RotationState, rosterPlayers: Player[], elapsedSeconds: number): void {
  const onCourtIds = new Set(state.onCourt.map((p) => p.id))

  rosterPlayers.forEach((player) => {
    const current = state.fatigue.get(player.id) ?? 0
    if (onCourtIds.has(player.id)) {
      state.fatigue.set(player.id, clamp(current + fatigueGainPerSecond(player) * elapsedSeconds, 0, 100))
      state.secondsPlayed.set(player.id, (state.secondsPlayed.get(player.id) ?? 0) + elapsedSeconds)
    } else {
      state.fatigue.set(player.id, clamp(current - fatigueRecoveryPerSecond(player) * elapsedSeconds, 0, 100))
    }
  })
}
