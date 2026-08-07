import type { Player, Team } from '../../data/types'
import { shiftPlayerAttribute, shiftPlayerAttributes, shiftPlayerHiddenTrait } from '../../engine/attributeShift'
import {
  DEFENSIVE_BOOTCAMP_DEFENSE_SHIFT,
  EXTRA_SHOOTAROUND_SHOOTING_SHIFT,
  FILM_ROOM_MARATHON_BALL_HANDLING_SHIFT,
  LOAD_MANAGEMENT_DURABILITY_SHIFT,
  LUCKY_JERSEY_ATTRIBUTE_SHIFT,
  SPORTS_PSYCH_SESSION_CLUTCH_SHIFT,
} from '../constants'
import type { ConsumableId } from './catalog'

export interface ApplyConsumableEffectResult {
  team: Team
  players: Player[]
}

function shiftRoster(players: Player[], teamId: Team['id'], shift: (p: Player) => Player): Player[] {
  return players.map((p) => (p.teamId === teamId ? shift(p) : p))
}

/**
 * Applies one consumable's effect (Section 8.7) -- same "flat shift to a rating the simulation
 * already reads" mechanic as run/coachingUpgrades/applyCoachingUpgrade.ts, just smaller magnitude.
 * Crucially, this is meant to be called against TRANSIENT roster/team copies scoped to a single
 * season's simulation (see run/simulateSeasonChunk.ts), never against the persisted bundle -- the
 * effect naturally expires once that season's local copies go out of scope, no revert needed.
 *
 * Energy Drink Sponsorship is a deliberate no-op here: it's not a simulation effect at all, just a
 * one-time run.budget bump applied immediately at activation time (RunProvider's
 * activateConsumable), before this function is ever called for it.
 */
export function applyConsumableEffect(consumableId: ConsumableId, team: Team, players: Player[]): ApplyConsumableEffectResult {
  switch (consumableId) {
    case 'sports-psych-session':
      return { team, players: shiftRoster(players, team.id, (p) => shiftPlayerHiddenTrait(p, 'clutch', SPORTS_PSYCH_SESSION_CLUTCH_SHIFT)) }

    case 'load-management':
      return { team, players: shiftRoster(players, team.id, (p) => shiftPlayerHiddenTrait(p, 'durability', LOAD_MANAGEMENT_DURABILITY_SHIFT)) }

    case 'film-room-marathon':
      return { team, players: shiftRoster(players, team.id, (p) => shiftPlayerAttribute(p, 'ballHandling', FILM_ROOM_MARATHON_BALL_HANDLING_SHIFT)) }

    case 'extra-shootaround':
      return {
        team,
        players: shiftRoster(players, team.id, (p) => {
          const withInside = shiftPlayerAttribute(p, 'insideShot', EXTRA_SHOOTAROUND_SHOOTING_SHIFT)
          return shiftPlayerAttribute(withInside, 'outsideShot', EXTRA_SHOOTAROUND_SHOOTING_SHIFT)
        }),
      }

    case 'defensive-bootcamp':
      return {
        team,
        players: shiftRoster(players, team.id, (p) => {
          const withInterior = shiftPlayerAttribute(p, 'interiorDefense', DEFENSIVE_BOOTCAMP_DEFENSE_SHIFT)
          return shiftPlayerAttribute(withInterior, 'perimeterDefense', DEFENSIVE_BOOTCAMP_DEFENSE_SHIFT)
        }),
      }

    case 'lucky-jersey':
      return { team, players: shiftRoster(players, team.id, (p) => shiftPlayerAttributes(p, LUCKY_JERSEY_ATTRIBUTE_SHIFT)) }

    case 'energy-drink-sponsorship':
      return { team, players }
  }
}
