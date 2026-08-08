import type { Player, PlayerId, Team } from '../../data/types'
import { avgInteriorDefense, avgPerimeterDefense, findAtSlot, pickBest, rawOverallQuality, type OnCourtPlayer } from '../matchup'
import {
  FATIGUE_EMERGENCY_THRESHOLD,
  FATIGUE_SUB_IN_MAX,
  FATIGUE_SUB_OUT_THRESHOLD,
  MIN_SHIFT_SECONDS,
  PACE_CHECK_MIN_SECONDS,
  PACE_OVERAGE_THRESHOLD,
  REGULATION_MINUTES,
  ROTATION_MATCHUP_WEIGHT,
  ROTATION_QUALITY_WEIGHT,
} from '../constants'
import type { RotationState } from './rotationState'

/**
 * Blends a bench candidate's own quality with fit against whichever opponent occupies the same
 * position -- mirrors the "shot profile picks the metric" pattern already used for isolation
 * defender assignment in playerSelector.ts. Never reads Player.overallRating.
 */
export function rotationValue(candidate: Player, opponent: Player | undefined): number {
  const quality = rawOverallQuality(candidate)
  if (!opponent) return quality
  const matchupFit =
    opponent.attributes.outsideShot > opponent.attributes.insideShot
      ? avgPerimeterDefense(candidate)
      : avgInteriorDefense(candidate)
  return ROTATION_QUALITY_WEIGHT * quality + ROTATION_MATCHUP_WEIGHT * matchupFit
}

function shouldConsiderSubOut(
  state: RotationState,
  player: Player,
  elapsedSeconds: number,
  rotationMinutes: Record<PlayerId, number>,
): boolean {
  const fatigueLevel = state.fatigue.get(player.id) ?? 0
  if (fatigueLevel >= FATIGUE_EMERGENCY_THRESHOLD) return true

  const enteredAt = state.shiftEnteredAtSeconds.get(player.id) ?? 0
  if (elapsedSeconds - enteredAt < MIN_SHIFT_SECONDS) return false

  if (fatigueLevel >= FATIGUE_SUB_OUT_THRESHOLD) return true

  if (elapsedSeconds < PACE_CHECK_MIN_SECONDS) return false

  const target = (rotationMinutes[player.id] ?? 0) / REGULATION_MINUTES
  const paceSoFar = (state.secondsPlayed.get(player.id) ?? 0) / elapsedSeconds
  return paceSoFar > target * (1 + PACE_OVERAGE_THRESHOLD)
}

/**
 * Checks each on-court player for a sub-out trigger and, if eligible, fills their slot with the
 * best-fit rested bench player. Mutates state.onCourt and state.shiftEnteredAtSeconds in place.
 * Slots are processed sequentially so two simultaneous outgoing players can never be assigned
 * the same incoming bench player. No rng -- substitution decisions are deterministic (coaching
 * decisions are structural, like defender assignment, not usage).
 *
 * The replacement inherits the *slot*, not the outgoing player's listed position -- those are the
 * same thing today, since candidates are still filtered to players whose own position matches the
 * slot, but it's the slot the incoming player will be evaluated as. Relaxing that filter is what
 * free-form lineups will do.
 */
export function checkSubstitutions(
  state: RotationState,
  team: Team,
  opponentOnCourt: OnCourtPlayer[],
  playersById: Map<PlayerId, Player>,
  elapsedSeconds: number,
): void {
  const nextFive = [...state.onCourt]

  for (let i = 0; i < nextFive.length; i++) {
    const { player: outgoing, slot } = nextFive[i]
    if (!shouldConsiderSubOut(state, outgoing, elapsedSeconds, team.rotationMinutes)) continue

    const onCourtIdsNow = new Set(nextFive.map((entry) => entry.player.id))
    const candidates = team.rosterPlayerIds
      .filter((id) => !onCourtIdsNow.has(id))
      .map((id) => {
        const p = playersById.get(id)
        if (!p) throw new Error(`Player ${id} on ${team.name}'s roster was not found`)
        return p
      })
      .filter((p) => p.positions[0] === slot)
      .filter((p) => (state.fatigue.get(p.id) ?? 0) <= FATIGUE_SUB_IN_MAX)

    if (candidates.length === 0) continue // whole position group too tired -- outgoing stays in

    const opponent = findAtSlot(slot, opponentOnCourt)
    const incoming = pickBest(candidates, (c) => rotationValue(c, opponent))
    nextFive[i] = { player: incoming, slot }
    state.shiftEnteredAtSeconds.set(incoming.id, elapsedSeconds)
  }

  state.onCourt = nextFive
}
