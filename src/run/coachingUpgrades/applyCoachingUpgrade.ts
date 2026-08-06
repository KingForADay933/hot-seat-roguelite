import type { Player, Team } from '../../data/types'
import { shiftPlayerAttribute, shiftPlayerAttributes, shiftPlayerHiddenTrait } from '../../engine/attributeShift'
import {
  BENCH_MOB_ATTRIBUTE_SHIFT,
  CLUTCH_GENE_CLUTCH_SHIFT,
  DEFENSIVE_COORDINATOR_DEFENSE_SHIFT,
  FILM_STUDY_BALL_HANDLING_SHIFT,
  IRON_MAN_DURABILITY_SHIFT,
  PLAYER_DEVELOPMENT_GURU_RATING_BONUS,
  STEADY_HAND_CONSISTENCY_SHIFT,
} from '../constants'
import type { CoachingUpgradeId } from './catalog'

export interface ApplyCoachingUpgradeResult {
  team: Team
  players: Player[]
}

function shiftRoster(players: Player[], teamId: Team['id'], shift: (p: Player) => Player): Player[] {
  return players.map((p) => (p.teamId === teamId ? shift(p) : p))
}

/**
 * Applies one coaching upgrade's permanent, one-time effect (Section 8.6) -- the same "flat shift
 * to a rating the simulation already reads" mechanic roster quirks and camps use, just team-wide
 * and GM-purchased instead of imposed or randomly rolled.
 *
 * Players' Coach and System Guru are deliberately no-ops here: their effect is a Team.synergyScore
 * bonus that has to be *re-added* every time synergyScore gets recomputed from roster fit (camp
 * purchases do this), not applied once -- see run/coachingUpgrades/synergyBonus.ts and its caller
 * in RunProvider. A one-time mutation here would just get silently overwritten by the next camp.
 */
export function applyCoachingUpgrade(upgradeId: CoachingUpgradeId, team: Team, players: Player[]): ApplyCoachingUpgradeResult {
  switch (upgradeId) {
    case 'clutch-gene':
      return { team, players: shiftRoster(players, team.id, (p) => shiftPlayerHiddenTrait(p, 'clutch', CLUTCH_GENE_CLUTCH_SHIFT)) }

    case 'iron-man-program':
      return { team, players: shiftRoster(players, team.id, (p) => shiftPlayerHiddenTrait(p, 'durability', IRON_MAN_DURABILITY_SHIFT)) }

    case 'film-study':
      return { team, players: shiftRoster(players, team.id, (p) => shiftPlayerAttribute(p, 'ballHandling', FILM_STUDY_BALL_HANDLING_SHIFT)) }

    case 'defensive-coordinator':
      return {
        team,
        players: shiftRoster(players, team.id, (p) => {
          const withInterior = shiftPlayerAttribute(p, 'interiorDefense', DEFENSIVE_COORDINATOR_DEFENSE_SHIFT)
          return shiftPlayerAttribute(withInterior, 'perimeterDefense', DEFENSIVE_COORDINATOR_DEFENSE_SHIFT)
        }),
      }

    case 'steady-hand':
      return { team, players: shiftRoster(players, team.id, (p) => shiftPlayerHiddenTrait(p, 'consistency', STEADY_HAND_CONSISTENCY_SHIFT)) }

    case 'player-development-guru':
      return { team: { ...team, coaching: { ...team.coaching, headCoachRating: team.coaching.headCoachRating + PLAYER_DEVELOPMENT_GURU_RATING_BONUS } }, players }

    case 'bench-mob-mentality': {
      const startingIds = new Set(team.startingFive)
      return {
        team,
        players: players.map((p) =>
          p.teamId === team.id && !startingIds.has(p.id) ? shiftPlayerAttributes(p, BENCH_MOB_ATTRIBUTE_SHIFT) : p,
        ),
      }
    }

    case 'players-coach':
    case 'system-guru':
      return { team, players }
  }
}
