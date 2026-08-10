import type { AttributeKey, Player, PlayerId } from '../../data/types'
import {
  DURABILITY_NEUTRAL,
  FATIGUE_ATTRIBUTE_PENALTY_MAX,
  FATIGUE_ATTRIBUTE_WEIGHTS,
  FATIGUE_CONSISTENCY_PENALTY_MAX,
  FATIGUE_DURABILITY_FACTOR,
  FATIGUE_GAIN_PER_SECOND,
  FATIGUE_HALFTIME_RECOVERY,
  FATIGUE_MULT_MAX,
  FATIGUE_MULT_MIN,
  FATIGUE_PENALTY_FULL_AT,
  FATIGUE_PENALTY_THRESHOLD,
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
 * 0 to 1: how far into the penalty band this player's fatigue has climbed. 0 for anyone at or below
 * FATIGUE_PENALTY_THRESHOLD, which is most of the league most of the time.
 */
export function fatiguePenaltyScale(fatigue: number): number {
  return clamp((fatigue - FATIGUE_PENALTY_THRESHOLD) / (FATIGUE_PENALTY_FULL_AT - FATIGUE_PENALTY_THRESHOLD), 0, 1)
}

/**
 * A transient copy of a player as tired legs have left him -- weaker where it shows first, and
 * harder to predict.
 *
 * **Never persisted, and never fed back into fatigue itself.** The caller hands this to possession
 * resolution only; rotation state keeps the real players, so a docked copy can't influence its own
 * accrual and the possession log still records real people. Same contract effectivePlayer carries
 * for the out-of-position penalty, which is the shift this composes with.
 *
 * Consistency is docked alongside the attributes, and that one line is the entire variance half of
 * the feature: possession/variance.ts's computeConsistencyNoise already derives its standard
 * deviation from `(100 - consistency)`, so handing it a tired player's lowered consistency widens the
 * swing with no new parameter, no change to that file, and the same number of rng draws. A gassed
 * player is not just worse, he is less reliable -- which is the half you feel rather than measure.
 *
 * Returns the same reference below the threshold, so the common case allocates nothing.
 */
export function fatiguedPlayer(player: Player, fatigue: number): Player {
  const scale = fatiguePenaltyScale(fatigue)
  if (scale <= 0) return player

  const attributes = { ...player.attributes }
  ;(Object.keys(attributes) as AttributeKey[]).forEach((key) => {
    const dock = FATIGUE_ATTRIBUTE_PENALTY_MAX * scale * FATIGUE_ATTRIBUTE_WEIGHTS[key]
    if (dock > 0) attributes[key] = clamp(attributes[key] - dock, 0, 100)
  })

  return {
    ...player,
    attributes,
    hidden: { ...player.hidden, consistency: clamp(player.hidden.consistency - FATIGUE_CONSISTENCY_PENALTY_MAX * scale, 0, 100) },
  }
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
