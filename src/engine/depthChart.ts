import type { Player, PlayerId, Position } from '../data/types'
import { REGULATION_MINUTES, ROTATION_DEPTH_WEIGHTS } from './constants'

export const ALL_POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

export interface DepthChart {
  startingFive: PlayerId[]
  rotationMinutes: Record<PlayerId, number>
}

/**
 * Who starts and who plays how long, derived from a roster.
 *
 * Lives here rather than inside the generator because it has two callers: generateTeam, and
 * RunProvider once run/variation/rosterQuirks.ts has reshaped the GM's roster. The quirk path had no
 * owner at all -- the house-rule path returned a modified team, quirks returned only players -- so the
 * lineup stayed whatever generation decided regardless of what happened to the attributes under it.
 *
 * Worth being precise about what that re-derive buys, because it is less than it looks. A position
 * tilt moves every player at a position by the same amount, so it preserves the ordering *within*
 * each position -- and since the five is the best at each position, the lineup usually comes back
 * unchanged. Measured over 60 rosters per quirk it changes the five 2/60 times for `stacked-guards`
 * (clamping at ATTRIBUTE_CEILING can reorder two players near the top) and 0/60 for every other
 * quirk. This is a correctness guard for a future quirk that reorders a position group, not a repair
 * for a lineup that was visibly wrong.
 *
 * Both readings of "who is best" use `overallRating`, which the simulation is otherwise barred from
 * touching. That is the sanctioned exception: roster *construction* is exactly the display-facing
 * question overall answers, and using anything else here would mean the depth chart disagreed with
 * the number shown next to each player.
 */
export function deriveDepthChart(players: Player[]): DepthChart {
  return { startingFive: pickStartingFive(players), rotationMinutes: computeRotationMinutes(players) }
}

/**
 * Best overall at each position, one per slot.
 *
 * One-per-position is an invariant, not a convenience: engine/matchup.ts's buildMatchups pairs the
 * two fives on slots, and run/variation/houseRules.ts relies on it too. A "best five regardless of
 * position" starting lineup would leave slots unfilled and matchups unpairable.
 */
function pickStartingFive(players: Player[]): PlayerId[] {
  return ALL_POSITIONS.map((position) => {
    const atPosition = players.filter((p) => p.positions.includes(position))
    // A roster with nobody at a position can only happen to a caller that built one; fall back to the
    // whole roster rather than throwing, so a house rule waiving the bench cannot crash the run.
    const pool = atPosition.length > 0 ? atPosition : players
    return pool.reduce((best, p) => (p.overallRating > best.overallRating ? p : best)).id
  })
}

/** Target minutes per rostered player, ranked by overallRating within each position group. */
function computeRotationMinutes(players: Player[]): Record<PlayerId, number> {
  const minutes: Record<PlayerId, number> = {}
  ALL_POSITIONS.forEach((position) => {
    const group = players.filter((p) => p.positions[0] === position).sort((a, b) => b.overallRating - a.overallRating)
    const weights = group.map((_, rank) => ROTATION_DEPTH_WEIGHTS[Math.min(rank, ROTATION_DEPTH_WEIGHTS.length - 1)])
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    group.forEach((p, i) => {
      minutes[p.id] = totalWeight > 0 ? (REGULATION_MINUTES * weights[i]) / totalWeight : 0
    })
  })
  return minutes
}
