import type { Player, PlayerId } from '../data/types'
import { shiftPlayerAttributes } from '../engine/attributeShift'
import { FRANCHISE_PLAYER_MIN } from './constants'

/**
 * Makes sure the roster the GM inherits has one player worth building around.
 *
 * The run hands you the league's *worst* roster on purpose (assignWorstTeam.ts), and that is meant to
 * be a hard hand rather than a hopeless one. Generation alone leaves roughly a fifth of those rosters
 * without a single player at FRANCHISE_PLAYER_MIN, and a team with no star and the league's thinnest
 * supporting cast is not a challenge to coach -- it is a run that was decided before it started.
 *
 * Deliberately a *floor*, not a set: a roster that already has a star keeps whatever it rolled, so
 * this never caps anyone and never fires on a team that doesn't need it. It lives in `run/` rather
 * than the generator because it is a statement about the roguelite's opening position, not about how
 * basketball players are distributed -- every other team in the league is left exactly as generated.
 *
 * **Lifts a starter, never the best player outright.** Raising a bench player to 82 would hand back
 * the depth-chart problem this release exists to fix -- a franchise player sitting behind someone
 * worse. Picking from the starting five means the guarantee and the depth chart agree.
 */
/** Bound on the lift loop below. Three is comfortably enough for any profile the generator produces;
 *  it exists so a player who genuinely cannot reach the threshold can't spin. */
const LIFT_PASSES = 3

/**
 * Moves a player to a target overall by shifting every attribute, keeping his *shape*.
 *
 * Shifted by the gap rather than set to the target, so a rim-running big lifted to 82 is still a
 * rim-running big -- a player to build a system around rather than a flat block of 82s.
 *
 * Applied repeatedly because a single shift undershoots: attributes clamp at ATTRIBUTE_CEILING, so a
 * spiky player whose best ratings are already near the top spends part of the lift against the
 * ceiling and lands short. Each pass re-reads the gap that is actually left, and the loop stops early
 * when a pass changes nothing -- which is the case where he is as high as the scale allows. Shared
 * with run/variation/rosterQuirks.ts's one-superstar, which lifts to 90 and hits the ceiling harder.
 */
export function liftToOverall(player: Player, target: number): Player {
  let lifted = player
  for (let pass = 0; pass < LIFT_PASSES && lifted.overallRating < target; pass++) {
    const next = shiftPlayerAttributes(lifted, target - lifted.overallRating)
    if (next.overallRating === lifted.overallRating) break
    lifted = next
  }
  return lifted
}

export function ensureFranchisePlayer(players: Player[], startingFive: PlayerId[]): Player[] {
  if (players.length === 0) return players
  if (players.some((p) => p.overallRating >= FRANCHISE_PLAYER_MIN)) return players

  const starters = new Set(startingFive)
  const candidates = players.filter((p) => starters.has(p.id))
  // A roster with no five to speak of can only come from a caller that built one; falling back to the
  // whole roster keeps this total rather than throwing during run setup.
  const pool = candidates.length > 0 ? candidates : players
  const best = pool.reduce((top, p) => (p.overallRating > top.overallRating ? p : top))
  const lifted = liftToOverall(best, FRANCHISE_PLAYER_MIN)

  return players.map((p) => (p.id === best.id ? lifted : p))
}
