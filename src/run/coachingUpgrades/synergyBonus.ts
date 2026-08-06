import { PLAYERS_COACH_SYNERGY_BONUS, SYSTEM_GURU_SYNERGY_BONUS } from '../constants'
import type { CoachingUpgradeId } from './catalog'

/** Flat Team.synergyScore bonus from owned coaching upgrades -- meant to be added on top of
 *  computeInitialSynergyScore's roster-fit result every time synergyScore is recomputed (draft,
 *  camp purchase, coaching-upgrade purchase), not applied as a one-time mutation. See
 *  applyCoachingUpgrade.ts's doc comment on the players-coach/system-guru cases for why. */
export function computeSynergyUpgradeBonus(owned: CoachingUpgradeId[]): number {
  let bonus = 0
  if (owned.includes('players-coach')) bonus += PLAYERS_COACH_SYNERGY_BONUS
  if (owned.includes('system-guru')) bonus += SYSTEM_GURU_SYNERGY_BONUS
  return bonus
}
