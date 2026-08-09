import { OFFENSIVE_PLAYBOOKS, type OffensivePlaybook, type SystemId } from '../../data/presets'
import type { Player, PlayerId, PlayCallType, Team } from '../../data/types'
import { SYNERGY_NEUTRAL, USAGE_WEIGHT_EXPONENT } from '../../engine/constants'
import { clamp } from '../../engine/math'
import type { Rng } from '../../engine/rng'
import { SYNERGY_AFFINITY_AMPLIFICATION, SYNERGY_SCORE_CEILING, SYNERGY_SCORE_FLOOR } from '../constants'
import { POSITION_MINUTES_BUDGET } from '../minutesBudget'
import { chartedMinutes, hasAnyChartedSegment } from '../rotationChart'
import { pickDistinct } from './draftPool'
import { ALL_PLAY_CALLS, PLAY_CALL_MODELS, type PossessionRole } from './possessionRoles'

export function pickRandomSystems(count: number, rng: Rng): SystemId[] {
  return pickDistinct(Object.keys(OFFENSIVE_PLAYBOOKS) as SystemId[], count, rng)
}

/** Everything about a team that bears on who is actually on the floor. `Team` satisfies it, so
 *  callers pass the team itself rather than picking fields off it. */
export type RotationSource = Partial<Pick<Team, 'rotationMinutes' | 'rotationPlan'>>

/**
 * Availability weight per player: share of the game he's on the floor for. The engine selects from
 * the on-court five; weighting each player by how much of the game he plays is what lets a bench
 * specialist still pick up some of the touches he's suited to, in proportion to his time.
 *
 * Two sources, because the team has two ways of deciding who plays:
 *
 * - **A rotation chart** names a specific player at a specific slot for a specific span. That time
 *   is known exactly, so it counts at face value -- including time at a slot that isn't his own,
 *   since he's on the floor either way.
 * - **`rotationMinutes`** governs everything the chart leaves Auto, because that's precisely what
 *   the coach heuristic reads (engine/rotation/substitution.ts). It's prorated by how much of that
 *   slot's budget the chart hasn't already spent: chart the PG slot end to end and the backup point
 *   guard's target minutes are worth nothing, because there is no Auto time left for him to take.
 *
 * Which makes the no-chart case exactly what it always was -- uncharted is the whole game, so the
 * proration factor is 1 and every player is weighted by his raw target minutes. Charting is a
 * continuous departure from that rather than a mode switch: one 60-second segment moves the weights
 * by one segment's worth.
 *
 * Falls back to counting everyone equally when there's nothing to go on at all (no chart, and
 * minutes unknown or all zero) -- computePlayerSystemAffinity scores a lone player that way.
 */
function availability(roster: Player[], rotation?: RotationSource): number[] {
  const targets = roster.map((p) => Math.max(0, rotation?.rotationMinutes?.[p.id] ?? 0))
  const equalWeights = () => roster.map(() => 1)

  if (!hasAnyChartedSegment(rotation?.rotationPlan)) {
    if (!rotation?.rotationMinutes) return equalWeights()
    return targets.some((m) => m > 0) ? targets : equalWeights()
  }

  const charted = chartedMinutes(rotation?.rotationPlan)
  const weights = roster.map((player, i) => {
    const spentAtHisSlot = charted.bySlot.get(player.positions[0]) ?? 0
    const autoShare = Math.max(POSITION_MINUTES_BUDGET - spentAtHisSlot, 0) / POSITION_MINUTES_BUDGET
    return (charted.byPlayer.get(player.id) ?? 0) + targets[i] * autoShare
  })

  return weights.some((w) => w > 0) ? weights : equalWeights()
}

/**
 * The share of a role's touches each player takes, mirroring engine/possession/playerSelector.ts's
 * pickWeighted exactly: selection weight is `selectionScore ^ USAGE_WEIGHT_EXPONENT`, scaled here
 * by how much of the game each player is available for.
 *
 * Reusing the engine's own exponent rather than inventing a separate knob is deliberate. That
 * exponent *is* the blend between "everybody shares the ball equally" (0) and "the best fit takes
 * every touch" (infinite); at its current value of 3 the best-suited player dominates a role
 * without monopolizing it, exactly as he will in a play-by-play readout. Tuning the sim's
 * concentration therefore retunes synergy automatically, and the two can't drift apart.
 */
function roleUsageShares(role: PossessionRole, roster: Player[], availabilityWeights: number[]): number[] {
  const weights = roster.map((p, i) => availabilityWeights[i] * Math.max(role.selectionScore(p), 0.01) ** USAGE_WEIGHT_EXPONENT)
  const total = weights.reduce((sum, x) => sum + x, 0)
  return total === 0 ? roster.map(() => 1 / roster.length) : weights.map((x) => x / total)
}

/**
 * Expected offense strength for one play call: for each role, who is actually likely to execute it
 * (roleUsageShares) times what they'd contribute (the engine's own strength weights), plus any
 * whole-roster term the play call has.
 *
 * This is the piece that makes touch logic matter. Averaging the roster instead -- the previous
 * approach -- said a Twin Towers roster of two elite bigs and three non-post guards was mediocre
 * in the post, when in fact the bigs take almost all of those possessions and it is excellent
 * there. Now the guards' inability to post up costs the team roughly what it costs in a real
 * game: the few post-ups they draw, and nothing more.
 */
function expectedPlayCallStrength(playCall: PlayCallType, roster: Player[], availabilityWeights: number[]): number {
  const model = PLAY_CALL_MODELS[playCall]
  const totalAvailability = availabilityWeights.reduce((sum, x) => sum + x, 0)

  const fromRoles = model.roles.reduce((sum, role) => {
    const shares = roleUsageShares(role, roster, availabilityWeights)
    return sum + roster.reduce((roleSum, p, i) => roleSum + shares[i] * role.contribution(p), 0)
  }, 0)

  if (!model.teamRebounding) return fromRoles
  const meanRebounding = roster.reduce((sum, p, i) => sum + availabilityWeights[i] * p.attributes.rebounding, 0) / totalAvailability
  return fromRoles + model.teamRebounding * meanRebounding
}

/** Expected strength per play call, computed once and reused for every candidate system -- these
 *  depend only on the roster, never on the playbook, which is what keeps affinity linear in the
 *  playbook's weights (and therefore coherent across the whole set of systems). */
function playCallStrengths(roster: Player[], rotation?: RotationSource): Record<PlayCallType, number> {
  const availabilityWeights = availability(roster, rotation)
  return Object.fromEntries(
    ALL_PLAY_CALLS.map((pc) => [pc, expectedPlayCallStrength(pc, roster, availabilityWeights)]),
  ) as Record<PlayCallType, number>
}

/** The system's own play-call weights, normalized to sum to 1. Null for a degenerate all-zero
 *  playbook, which no shipped preset is, but the math would divide by zero on. */
function normalizedWeights(playbook: OffensivePlaybook): Record<PlayCallType, number> | null {
  const total = ALL_PLAY_CALLS.reduce((sum, pc) => sum + playbook.weights[pc], 0)
  if (total === 0) return null
  return Object.fromEntries(ALL_PLAY_CALLS.map((pc) => [pc, playbook.weights[pc] / total])) as Record<PlayCallType, number>
}

/** Weighted blend of per-play-call strengths by a system's mix, minus the flat average across all
 *  six -- i.e. how much better this system's actual play diet is than an even one. Shared by the
 *  team score and the per-player readout so both are centered the same way. */
function affinityFromStrengths(playbook: OffensivePlaybook, strengths: Record<PlayCallType, number>): number {
  const weights = normalizedWeights(playbook)
  if (!weights) return 0
  const weighted = ALL_PLAY_CALLS.reduce((sum, pc) => sum + weights[pc] * strengths[pc], 0)
  const baseline = ALL_PLAY_CALLS.reduce((sum, pc) => sum + strengths[pc], 0) / ALL_PLAY_CALLS.length
  return weighted - baseline
}

/**
 * One player's affinity for a system, measured as if he were the one executing: how much better or
 * worse the system's play-call mix suits his game than an even mix would. Signed and centered on 0
 * -- positive means the system leans on what he does well.
 *
 * Because every playbook's weights sum to 1, these are all departures from a common reference, so
 * they cannot all be positive: a center whose value is concentrated in Post-Up necessarily rates
 * negative for Pace and Space, since the possessions it adds (spot-ups, transition) are exactly the
 * ones he grades below his own baseline at. It is also talent-neutral by construction, which is the
 * point -- raw quality just re-measured how good a player was, so every system rated a good player
 * highly and which one you picked barely moved the number.
 *
 * Note this is the player in isolation; it deliberately ignores usage, because "does this system
 * suit him" and "will he get the ball" are different questions. computeProjectedUsageShares answers
 * the second, and the team score below combines them.
 */
export function computePlayerSystemAffinity(playbook: OffensivePlaybook, player: Player): number {
  return affinityFromStrengths(playbook, playCallStrengths([player]))
}

/**
 * The value written to Team.synergyScore when a system is drafted, on the attribute-ish scale
 * engine/possession/possessionStrength.ts's synergyMultiplier consumes directly: SYNERGY_NEUTRAL
 * plus the roster's amplified affinity, where each play call is graded by whoever would actually
 * take those possessions (see expectedPlayCallStrength).
 *
 * A roster with no particular lean lands exactly on SYNERGY_NEUTRAL and plays at a 1.0 multiplier
 * -- deliberately, since raw talent already reaches offensive strength through the attributes
 * themselves. Synergy is purely the question of whether these specific players, in this rotation,
 * suit this specific system.
 */
export function computeInitialSynergyScore(
  playbook: OffensivePlaybook,
  roster: Player[],
  rotation?: RotationSource,
): number {
  if (roster.length === 0) return SYNERGY_NEUTRAL
  const affinity = affinityFromStrengths(playbook, playCallStrengths(roster, rotation))
  return Math.round(clamp(SYNERGY_NEUTRAL + affinity * SYNERGY_AFFINITY_AMPLIFICATION, SYNERGY_SCORE_FLOOR, SYNERGY_SCORE_CEILING))
}

/**
 * Each player's projected share of the offense under a system: the fraction of role-touches he
 * takes across the season, given the play-call mix, his fit for each role, and his minutes. Sums to
 * 1 across the roster.
 *
 * Same selection math the engine will use possession by possession, so this is a genuine forecast
 * of a play-by-play readout rather than a UI-only guess -- picking Twin Towers should visibly hand
 * the ball to the bigs before a single game is simulated.
 */
export function computeProjectedUsageShares(
  playbook: OffensivePlaybook,
  roster: Player[],
  rotation?: RotationSource,
): Map<PlayerId, number> {
  const shares = new Map<PlayerId, number>(roster.map((p) => [p.id, 0]))
  const weights = normalizedWeights(playbook)
  if (!weights || roster.length === 0) return shares

  const availabilityWeights = availability(roster, rotation)
  let totalRoleWeight = 0

  for (const pc of ALL_PLAY_CALLS) {
    if (weights[pc] === 0) continue
    for (const role of PLAY_CALL_MODELS[pc].roles) {
      const roleShares = roleUsageShares(role, roster, availabilityWeights)
      roster.forEach((p, i) => shares.set(p.id, (shares.get(p.id) ?? 0) + weights[pc] * roleShares[i]))
      totalRoleWeight += weights[pc]
    }
  }

  if (totalRoleWeight > 0) for (const [id, share] of shares) shares.set(id, share / totalRoleWeight)
  return shares
}

export interface PlayCallFit {
  playCall: PlayCallType
  /** The system's own weight for this play call, normalized to 0-1 across the playbook. */
  weight: number
  /** Expected offense strength for it given who'd actually execute, on the 0-100 attribute scale. */
  rosterQuality: number
  /** That strength minus the roster's flat average across all six play calls -- positive means a
   *  play call this roster runs better than it runs in general, which is what moves the score. */
  vsBaseline: number
}

/**
 * Per-play-call breakdown behind a system's synergy score, heaviest call first -- lets the reveal
 * screen explain *why* a system scores what it does ("Post-Up is half your possessions and the guys
 * who'd take them grade 9 above this roster's baseline") instead of dropping a bare number.
 */
export function computeSystemFitBreakdown(
  playbook: OffensivePlaybook,
  roster: Player[],
  rotation?: RotationSource,
): PlayCallFit[] {
  const totalPlaybookWeight = ALL_PLAY_CALLS.reduce((sum, pc) => sum + playbook.weights[pc], 0)
  if (roster.length === 0) {
    return ALL_PLAY_CALLS.filter((pc) => playbook.weights[pc] > 0).map((pc) => ({
      playCall: pc,
      weight: totalPlaybookWeight === 0 ? 0 : playbook.weights[pc] / totalPlaybookWeight,
      rosterQuality: 0,
      vsBaseline: 0,
    }))
  }

  const strengths = playCallStrengths(roster, rotation)
  const baseline = ALL_PLAY_CALLS.reduce((sum, pc) => sum + strengths[pc], 0) / ALL_PLAY_CALLS.length

  return ALL_PLAY_CALLS.filter((pc) => playbook.weights[pc] > 0)
    .map((pc) => ({
      playCall: pc,
      weight: totalPlaybookWeight === 0 ? 0 : playbook.weights[pc] / totalPlaybookWeight,
      rosterQuality: Math.round(strengths[pc]),
      vsBaseline: Math.round(strengths[pc] - baseline),
    }))
    .sort((a, b) => b.weight - a.weight)
}
