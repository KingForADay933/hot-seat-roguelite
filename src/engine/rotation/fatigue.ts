import type { Player, PlayerId } from '../../data/types'
import {
  DURABILITY_NEUTRAL,
  FATIGUE_DURABILITY_FACTOR,
  FATIGUE_GAIN_PER_SECOND,
  FATIGUE_HALFTIME_RECOVERY,
  FATIGUE_MULT_MAX,
  FATIGUE_MULT_MIN,
  FATIGUE_PERIOD_BREAK_RECOVERY,
  FATIGUE_RECOVERY_PER_SECOND,
  HALFTIME_AFTER_PERIOD,
} from '../constants'
import { clamp } from '../math'
import type { RotationState } from './rotationState'

/** How much faster than neutral this player recovers -- shared by bench rest and break rest, so a
 *  durable player is durable in both and the Iron Man Program doesn't stop mattering at halftime. */
function durabilityRecoveryMultiplier(player: Player): number {
  return clamp(
    1 + (player.hidden.durability - DURABILITY_NEUTRAL) * FATIGUE_DURABILITY_FACTOR,
    FATIGUE_MULT_MIN,
    FATIGUE_MULT_MAX,
  )
}

export function fatigueGainPerSecond(player: Player): number {
  const mult = clamp(
    1 - (player.hidden.durability - DURABILITY_NEUTRAL) * FATIGUE_DURABILITY_FACTOR,
    FATIGUE_MULT_MIN,
    FATIGUE_MULT_MAX,
  )
  return FATIGUE_GAIN_PER_SECOND * mult
}

export function fatigueRecoveryPerSecond(player: Player): number {
  return FATIGUE_RECOVERY_PER_SECOND * durabilityRecoveryMultiplier(player)
}

/**
 * Fatigue points a break gives back, before durability -- 0 anywhere that isn't a break.
 *
 * Takes the period that has just *finished*, so period 2 is halftime and periods 1 and 3 are the
 * quarter breaks. Every period end from regulation's last one onward is an overtime break, which
 * gets the short version: five extra minutes is not a second halftime.
 */
export function breakRecoveryPoints(periodJustEnded: number): number {
  if (periodJustEnded === HALFTIME_AFTER_PERIOD) return FATIGUE_HALFTIME_RECOVERY
  return FATIGUE_PERIOD_BREAK_RECOVERY
}

/**
 * Hands everyone -- on court and benched alike -- a break's worth of recovery.
 *
 * The one thing tickFatigue cannot express. It divides the roster into "playing, so tiring" and
 * "sitting, so recovering", which is exactly right while the clock is running and exactly wrong the
 * moment it stops: at a quarter break nobody is playing, so the five who have been out there get
 * the same rest as the bench. Without this a starter's fatigue only ever went one direction for
 * forty-eight minutes, and the rotation churned to compensate for exhaustion a real halftime would
 * have cleared.
 *
 * Takes a bare Map rather than a RotationState because four separate places model fatigue -- the
 * live sim, the simcast's replay, the Coaching Insights reconstruction, and the rotation chart's
 * projection -- and every one of them has to apply the identical rule or they will quietly disagree
 * about the same game. A Map is the only shape all four have in common.
 */
export function applyBreakRecovery(fatigue: Map<PlayerId, number>, players: Player[], periodJustEnded: number): void {
  const points = breakRecoveryPoints(periodJustEnded)
  if (points <= 0) return

  players.forEach((player) => {
    const current = fatigue.get(player.id) ?? 0
    fatigue.set(player.id, clamp(current - points * durabilityRecoveryMultiplier(player), 0, 100))
  })
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
  const onCourtIds = new Set(state.onCourt.map((entry) => entry.player.id))

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
