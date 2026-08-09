import type { Player, PlayerId, Position, Team } from '../data/types'
import { REGULATION_MINUTES } from '../engine/constants'
import { POSITION_ORDER } from '../engine/matchup'

/**
 * Rotation minutes as a fixed, per-position allocation rather than a free-form number per player.
 *
 * One player occupies each slot for all 48 minutes of a game, so each position group has exactly
 * REGULATION_MINUTES to hand out and the team has 5 x 48 = 240 in total. That was already true of
 * every generated team -- engine/generator/randomTeam.ts's computeRotationMinutes normalizes
 * ROTATION_DEPTH_WEIGHTS to sum to REGULATION_MINUTES within each position group, and that
 * constant's own doc comment says so -- but nothing enforced it once a GM started editing, so
 * minutes could be set to any number regardless of whether that time existed to give.
 *
 * Grouped by each player's own positions[0], which is the same grouping the simulation substitutes
 * within: engine/rotation/substitution.ts's heuristic only ever considers bench candidates whose
 * position matches the slot being filled, so a position group's minutes are genuinely only
 * spendable on that group. (A rotation chart can put a player in another slot, and the
 * out-of-position penalty prices that -- but rotationMinutes stays the Auto-fallback input, per
 * rotation-charts.md Phase F, and the heuristic it feeds never crosses position groups.)
 */

/** Minutes available at one position over one game -- one slot, occupied continuously for 48. */
export const POSITION_MINUTES_BUDGET = REGULATION_MINUTES

export interface PositionMinutes {
  position: Position
  /** Total currently assigned across every player whose own position is this one. */
  assigned: number
  /** Whole unassigned minutes left to give, or 0 when the group is already at or over budget. A
   *  group can sit under budget without anything being wrong: a roster-trimming house rule
   *  (run/variation/houseRules.ts) drops players after the generator has allocated their share,
   *  which simply leaves that position's targets summing to less than the game it has to cover. */
  remaining: number
  /** True when assigned exceeds the budget -- only reachable on a run saved before minutes were
   *  constrained, since nothing can write an over-budget value now. */
  isOverBudget: boolean
}

function playersAtPosition(roster: Player[], position: Position): Player[] {
  return roster.filter((p) => p.positions[0] === position)
}

function assignedAt(team: Team, roster: Player[], position: Position, exceptPlayerId?: PlayerId): number {
  return playersAtPosition(roster, position)
    .filter((p) => p.id !== exceptPlayerId)
    .reduce((sum, p) => sum + (team.rotationMinutes[p.id] ?? 0), 0)
}

/** Every position's current allocation, in PG-to-C order -- the GM-facing readout above the
 *  minutes inputs, so a capped input reads as "that time is already spoken for" rather than as a
 *  broken control. */
export function positionMinutesSummary(team: Team, roster: Player[]): PositionMinutes[] {
  return POSITION_ORDER.map((position) => {
    const assigned = assignedAt(team, roster, position)
    return {
      position,
      assigned,
      remaining: Math.max(Math.floor(POSITION_MINUTES_BUDGET - assigned), 0),
      isOverBudget: assigned > POSITION_MINUTES_BUDGET,
    }
  })
}

/**
 * The most this player can be given: their position's whole budget less whatever their positional
 * teammates already hold. Raising one player therefore requires lowering another at the same
 * position, which is what makes minutes a real allocation decision rather than a wish.
 *
 * Rounded *down* to whole minutes, and floored at 0. Down because generated targets are unrounded
 * (ROTATION_DEPTH_WEIGHTS normalized across a group divides 48 into thirds and seventeenths), so
 * rounding up could let a group creep past its budget by a fraction; at 0 because an over-budget
 * group (only reachable from a run saved before this rule existed) would otherwise produce a
 * negative ceiling -- editing any player in such a group pulls the whole group back inside the
 * budget in one write.
 */
export function maxMinutesFor(team: Team, roster: Player[], playerId: PlayerId): number {
  const player = roster.find((p) => p.id === playerId)
  if (!player) return 0
  return Math.max(Math.floor(POSITION_MINUTES_BUDGET - assignedAt(team, roster, player.positions[0], playerId)), 0)
}

/** Rounds and clamps a requested minutes value into what's actually available at that position. */
export function clampToPositionBudget(team: Team, roster: Player[], playerId: PlayerId, minutes: number): number {
  const requested = Math.round(minutes)
  if (!Number.isFinite(requested) || requested <= 0) return 0
  return Math.min(requested, maxMinutesFor(team, roster, playerId))
}
