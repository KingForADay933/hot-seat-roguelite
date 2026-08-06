import type { AttributeKey, Player, PlayerId, TeamId } from '../../data/types'
import { shiftPlayerAttribute } from '../../engine/attributeShift'
import type { Rng } from '../../engine/rng'
import { CAMP_ATTRIBUTE_SHIFT_MAX, CAMP_ATTRIBUTE_SHIFT_MIN, TEAM_CAMP_ATTRIBUTE_SHIFT_MAX, TEAM_CAMP_ATTRIBUTE_SHIFT_MIN } from '../constants'

function rollShift(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Applies a bounded-random-magnitude boost to one GM-chosen attribute on one GM-chosen player --
 *  same bounded-shift mechanic as Tier 3's wildcard breakout (run/variation/wildcardEvents.ts),
 *  but both *who* and *which attribute* are deliberate choices (Section 8.5), not rolled. */
export function applyPlayerCamp(players: Player[], playerId: PlayerId, attribute: AttributeKey, rng: Rng): Player[] {
  const shift = rollShift(CAMP_ATTRIBUTE_SHIFT_MIN, CAMP_ATTRIBUTE_SHIFT_MAX, rng)
  return players.map((p) => (p.id === playerId ? shiftPlayerAttribute(p, attribute, shift) : p))
}

/** Same mechanic spread across the whole roster, targeting the one GM-chosen attribute for every
 *  player -- each player still rolls their own shift magnitude independently, at the smaller
 *  TEAM_CAMP_ATTRIBUTE_SHIFT_* bound (see constants.ts for why). */
export function applyTeamCamp(players: Player[], teamId: TeamId, attribute: AttributeKey, rng: Rng): Player[] {
  return players.map((p) => (p.teamId === teamId ? shiftPlayerAttribute(p, attribute, rollShift(TEAM_CAMP_ATTRIBUTE_SHIFT_MIN, TEAM_CAMP_ATTRIBUTE_SHIFT_MAX, rng)) : p))
}
