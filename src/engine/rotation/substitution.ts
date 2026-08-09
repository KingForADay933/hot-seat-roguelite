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

/**
 * Whoever the chart insists on for each slot right now, aligned to `five`'s own indices, with null
 * for every slot the fatigue/pace heuristic should handle instead.
 *
 * Resolved for all five slots up front rather than slot-by-slot inside the loop because a chart can
 * name the same player in two slots at once. The editor flags that in red
 * (run/rotationChartValidation.ts's doubleBookedConflicts) but doesn't block saving one, so an
 * unsatisfiable plan genuinely reaches the engine -- and honoring it slot-by-slot seated one player
 * twice, leaving four bodies on the floor and a duplicate whose minutes deriveBoxScore counted once
 * per slot. Doubled minutes then flow into season development (engine/development/seasonMinutes.ts
 * feeds dpFormula), so the corruption outlived the game it happened in.
 *
 * A claimed player wins the first slot that asks for them in POSITION_ORDER and the losing slot
 * falls through to the heuristic -- the same fallback an Auto span and an exhausted charted player
 * already use, so a double-book degrades to ordinary coaching rather than to a broken five.
 */
function resolveChartedFive(
  five: OnCourtPlayer[],
  team: Team,
  playersById: Map<PlayerId, Player>,
  fatigue: Map<PlayerId, number>,
  period: number,
  secondsIntoPeriod: number,
): (Player | null)[] {
  const claimed = new Set<PlayerId>()

  return five.map(({ player: current, slot }) => {
    const chartedId = chartedPlayerId(team.rotationPlan, period, slot, secondsIntoPeriod)
    if (chartedId === null) return null

    // Phase H's deviation rule, unchanged -- an exhausted charted player is not brought in or kept
    // in, and doesn't claim the slot against another that could still legitimately use them.
    const chartedFatigue = fatigue.get(chartedId) ?? 0
    const deputyIsIn = current.id !== chartedId
    if (chartedFatigue >= FATIGUE_EMERGENCY_THRESHOLD || (deputyIsIn && chartedFatigue > FATIGUE_SUB_OUT_THRESHOLD)) {
      return null
    }

    if (claimed.has(chartedId)) return null // double-booked -- an earlier slot already has them
    const charted = playersById.get(chartedId)
    if (!charted) return null // plan names someone off this roster; nothing to seat

    claimed.add(chartedId)
    return charted
  })
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
 * The replacement inherits the *slot*, not the outgoing player's listed position, since the slot is
 * what the incoming player will be evaluated as. The heuristic's own candidates are still filtered
 * to players whose position matches the slot, so it never creates a mismatch by itself -- only a
 * GM's chart does, and engine/positionFit.ts prices it when they do.
 *
 * `team.rotationPlan` (rotation-charts.md Phase F) is consulted first, per slot: a charted segment
 * is law (Decision 3) and wins outright, bypassing the fatigue/pace heuristic below entirely. All
 * five slots are resolved against the chart before any of them is applied (resolveChartedFive), so
 * a plan naming one player in two slots at once can't seat them twice -- see that function.
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
  const charted = resolveChartedFive(nextFive, team, playersById, state.fatigue, period, secondsIntoPeriod)

  for (let i = 0; i < nextFive.length; i++) {
    const { player: outgoing, slot } = nextFive[i]

    const chartedPlayer = charted[i]
    if (chartedPlayer) {
      if (chartedPlayer.id !== outgoing.id) {
        nextFive[i] = { player: chartedPlayer, slot }
        state.shiftEnteredAtSeconds.set(chartedPlayer.id, elapsedSeconds)
      }
      continue // charted spans are law
    }
    // Otherwise the chart is silent, deviating, or unsatisfiable here -- fall through to the
    // heuristic, exactly as an Auto span does.

    // An earlier slot's charted assignment may have taken this slot's occupant, since a GM can
    // chart the same player into PG for one span and SG for the next. That leaves them standing in
    // two places at once, so the vacated slot has to be refilled now whether or not the ordinary
    // sub-out triggers fire -- a five with a duplicate in it isn't a lineup the sim can resolve.
    const displaced = nextFive.some((entry, j) => j !== i && entry.player.id === outgoing.id)
    if (!displaced && !shouldConsiderSubOut(state, outgoing, elapsedSeconds, team.rotationMinutes)) continue

    const onCourtIdsNow = new Set(nextFive.map((entry) => entry.player.id))
    const available = team.rosterPlayerIds
      .filter((id) => !onCourtIdsNow.has(id))
      .map((id) => {
        const p = playersById.get(id)
        if (!p) throw new Error(`Player ${id} on ${team.name}'s roster was not found`)
        return p
      })

    const atSlot = available.filter((p) => p.positions[0] === slot)
    const rested = atSlot.filter((p) => (state.fatigue.get(p.id) ?? 0) <= FATIGUE_SUB_IN_MAX)

    // A displaced slot has to be filled by someone, so its preferences relax in turn: the usual
    // rested same-position pick first, then a tired one, then anyone left on the bench. An ordinary
    // fatigue/pace sub keeps the strict filter and simply doesn't happen when nobody qualifies.
    const candidates = displaced ? (rested.length > 0 ? rested : atSlot.length > 0 ? atSlot : available) : rested

    if (candidates.length === 0) continue // whole position group too tired -- outgoing stays in

    const opponent = findAtSlot(slot, opponentOnCourt)
    const incoming = pickBest(candidates, (c) => rotationValue(c, opponent))
    nextFive[i] = { player: incoming, slot }
    state.shiftEnteredAtSeconds.set(incoming.id, elapsedSeconds)
  }

  state.onCourt = nextFive
}
