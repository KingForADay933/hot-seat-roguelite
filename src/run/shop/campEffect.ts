import type { Player, PlayerId, TeamId } from '../../data/types'
import { shiftPlayerAttributes } from '../../engine/attributeShift'
import type { Rng } from '../../engine/rng'
import { CAMP_ATTRIBUTE_SHIFT_MAX, CAMP_ATTRIBUTE_SHIFT_MIN, TEAM_CAMP_ATTRIBUTE_SHIFT_MAX, TEAM_CAMP_ATTRIBUTE_SHIFT_MIN } from '../constants'

function rollShift(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Applies a bounded random attribute boost to one player -- the same shiftPlayerAttributes
 *  mechanic as Tier 3's wildcard breakout (run/variation/wildcardEvents.ts), just chosen and
 *  paid for (Section 8.5) instead of random and free. */
export function applyPlayerCamp(players: Player[], playerId: PlayerId, rng: Rng): Player[] {
  const shift = rollShift(CAMP_ATTRIBUTE_SHIFT_MIN, CAMP_ATTRIBUTE_SHIFT_MAX, rng)
  return players.map((p) => (p.id === playerId ? shiftPlayerAttributes(p, shift) : p))
}

/** Same mechanic spread across the whole roster -- each player rolls independently, at the
 *  smaller TEAM_CAMP_ATTRIBUTE_SHIFT_* bound (see constants.ts for why). */
export function applyTeamCamp(players: Player[], teamId: TeamId, rng: Rng): Player[] {
  return players.map((p) => (p.teamId === teamId ? shiftPlayerAttributes(p, rollShift(TEAM_CAMP_ATTRIBUTE_SHIFT_MIN, TEAM_CAMP_ATTRIBUTE_SHIFT_MAX, rng)) : p))
}
