import { OFFENSIVE_PLAYBOOKS, type SystemId } from '../data/presets'
import type { Player, Team } from '../data/types'
import { focusedPlaybook } from '../engine/tacticalFocus'
import { computeSynergyUpgradeBonus, type CoachingUpgradeId } from './coachingUpgrades'
import { computeInitialSynergyScore } from './variation/systemDraft'

/**
 * A team's synergy score as it stands right now: roster fit to the play-call mix it will actually
 * run, plus whatever coaching upgrades add.
 *
 * Extracted because there are two callers that must not drift. RunProvider's
 * `teamsWithRecomputedSynergy` writes this to the saved bundle whenever an input moves -- camps,
 * upgrades, minutes, the rotation chart, the tactical dials. SimcastScreen computes the same number
 * to send with a mid-game focus directive, because the engine cannot compute one for itself. If those
 * two ever disagreed, changing a dial mid-broadcast would leave the running game playing at a
 * different synergy from the one the checkpoint shows a minute later, which is the kind of bug that
 * reads as the sim being wrong.
 *
 * The focus argument matters: `focusedPlaybook` is what makes shot selection roster-dependent, since
 * it changes the mix the roster is scored against. Hunting threes with Twin Towers really is a worse
 * fit, and this is the function that says so.
 */
export function resolveSynergyScore(
  team: Team,
  roster: Player[],
  coachingUpgrades: CoachingUpgradeId[],
  focus = team.tacticalFocus,
): number {
  return (
    computeInitialSynergyScore(focusedPlaybook(OFFENSIVE_PLAYBOOKS[team.offensiveStrategyId as SystemId], focus), roster, team) +
    computeSynergyUpgradeBonus(coachingUpgrades)
  )
}
