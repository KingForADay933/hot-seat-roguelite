import type { Player, PlayerId, Position, Team } from '../../data/types'
import { avgInteriorDefense, avgPerimeterDefense, findAtPosition, pickBest, rawOverallQuality } from '../matchup'
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
 * Checks each on-court player for a sub-out trigger and, if eligible, swaps in the best-fit
 * rested same-position bench player. Mutates state.onCourt and state.shiftEnteredAt in place.
 * Slots are processed sequentially so two simultaneous outgoing players can never be assigned
 * the same incoming bench player. No rng -- substitution decisions are deterministic (coaching
 * decisions are structural, like defender assignment, not usage).
 */
export function checkSubstitutions(
  state: RotationState,
  team: Team,
  opponentOnCourt: Player[],
  playersById: Map<PlayerId, Player>,
  elapsedSeconds: number,
): void {
  const nextFive = [...state.onCourt]

  for (let i = 0; i < nextFive.length; i++) {
    const outgoing = nextFive[i]
    if (!shouldConsiderSubOut(state, outgoing, elapsedSeconds, team.rotationMinutes)) continue

    const position: Position = outgoing.positions[0]
    const onCourtIdsNow = new Set(nextFive.map((p) => p.id))
    const candidates = team.rosterPlayerIds
      .filter((id) => !onCourtIdsNow.has(id))
      .map((id) => {
        const p = playersById.get(id)
        if (!p) throw new Error(`Player ${id} on ${team.name}'s roster was not found`)
        return p
      })
      .filter((p) => p.positions[0] === position)
      .filter((p) => (state.fatigue.get(p.id) ?? 0) <= FATIGUE_SUB_IN_MAX)

    if (candidates.length === 0) continue // whole position group too tired -- outgoing stays in

    const opponent = findAtPosition(position, opponentOnCourt)
    const incoming = pickBest(candidates, (c) => rotationValue(c, opponent))
    nextFive[i] = incoming
    state.shiftEnteredAtSeconds.set(incoming.id, elapsedSeconds)
  }

  state.onCourt = nextFive
}
