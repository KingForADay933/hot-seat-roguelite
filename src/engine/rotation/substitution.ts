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
import { chartedPlayerId } from './rotationPlan'
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
 *
 * `team.rotationPlan` (rotation-charts.md Phase F) is consulted first, per slot: a charted segment
 * is law (Decision 3) and wins outright, bypassing the fatigue/pace heuristic below entirely.
 *
 * The one exception is Phase H's deviation rule: a charted player who has actually hit
 * FATIGUE_EMERGENCY_THRESHOLD is not brought in or kept in -- the slot falls through to the
 * heuristic below instead, which pulls them (the emergency threshold already bypasses its own
 * shift cooldown) and manages whoever deputizes on ordinary fatigue/pace terms, including further
 * subs among the bench if the deputy tires too. The deviation clears itself once the charted
 * player has actually recovered (down to FATIGUE_SUB_OUT_THRESHOLD, not merely under the emergency
 * line) rather than the instant they dip under 95 -- otherwise the chart would yank a deputy back
 * out after one possession of rest, right back to someone still nearly as gassed as when they left.
 * Every other charted case is untouched: no plan, no segment for this period, an explicit `auto`
 * segment, or a charted player who is merely tired but not exhausted, all still fall through to (or
 * bypass) the heuristic exactly as Phase F left them.
 */
export function checkSubstitutions(
  state: RotationState,
  team: Team,
  opponentOnCourt: OnCourtPlayer[],
  playersById: Map<PlayerId, Player>,
  elapsedSeconds: number,
  period: number,
  secondsIntoPeriod: number,
): void {
  const nextFive = [...state.onCourt]

  for (let i = 0; i < nextFive.length; i++) {
    const { player: outgoing, slot } = nextFive[i]

    const chartedId = chartedPlayerId(team.rotationPlan, period, slot, secondsIntoPeriod)
    if (chartedId !== null) {
      const chartedFatigue = state.fatigue.get(chartedId) ?? 0
      const deputyIsIn = outgoing.id !== chartedId
      const deviating = chartedFatigue >= FATIGUE_EMERGENCY_THRESHOLD || (deputyIsIn && chartedFatigue > FATIGUE_SUB_OUT_THRESHOLD)

      if (!deviating) {
        if (chartedId !== outgoing.id) {
          const incoming = playersById.get(chartedId)
          if (incoming) {
            nextFive[i] = { player: incoming, slot }
            state.shiftEnteredAtSeconds.set(incoming.id, elapsedSeconds)
          }
        }
        continue // charted spans are law
      }
      // else fall through to the heuristic below -- see this function's doc comment.
    }

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
