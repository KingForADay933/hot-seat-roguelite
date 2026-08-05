import { OFFENSIVE_PLAYBOOKS, type OffensivePlaybook, type SystemId } from '../../data/presets'
import type { Player, PlayCallType } from '../../data/types'
import { average } from '../../engine/math'
import type { Rng } from '../../engine/rng'
import { pickDistinct } from './draftPool'

export function pickRandomSystems(count: number, rng: Rng): SystemId[] {
  return pickDistinct(Object.keys(OFFENSIVE_PLAYBOOKS) as SystemId[], count, rng)
}

/**
 * A single player's fit for one play-call type, echoing (a simplified, roster-wide version of)
 * the same attribute associations engine/possession/possessionStrength.ts's computeOffenseStrength
 * already uses -- so a system's synergy score is grounded in the same math that plays the games,
 * not a parallel invented metric. Simplified because synergy is a team-wide roster-fit signal, not
 * a specific play (no handler/roller role split).
 */
function playCallQuality(player: Player, playCall: PlayCallType): number {
  const a = player.attributes
  switch (playCall) {
    case 'pick-and-roll':
      return average([a.ballHandling, a.passing, a.insideShot, a.vertical])
    case 'isolation':
      return average([a.ballHandling, a.outsideShot, a.insideShot])
    case 'post-up':
      return average([a.insideShot, a.vertical])
    case 'spot-up':
      return average([a.outsideShot, a.passing])
    case 'cutting':
      return average([a.speed, a.passing])
    case 'transition':
      return average([a.speed, a.passing, a.rebounding])
  }
}

/**
 * The initial value for Team.synergyScore when a system is drafted: the roster's average
 * play-call quality (see playCallQuality), weighted by how heavily the system calls each play --
 * a system that leans on plays the roster is bad at scores low, on purpose (Twin Towers drafted
 * onto a Stacked-at-Guard roster is meant to score poorly). Returns a value on the same
 * attribute-ish scale as SYNERGY_NEUTRAL (65), for engine/possession/possessionStrength.ts's
 * synergyMultiplier to consume directly.
 */
export function computeInitialSynergyScore(playbook: OffensivePlaybook, roster: Player[]): number {
  const playCallTypes = Object.keys(playbook.weights) as PlayCallType[]
  const totalWeight = playCallTypes.reduce((sum, pc) => sum + playbook.weights[pc], 0)
  if (roster.length === 0 || totalWeight === 0) return 65

  const weightedSum = playCallTypes.reduce((sum, pc) => {
    const rosterQualityForPlayCall = average(roster.map((p) => playCallQuality(p, pc)))
    return sum + playbook.weights[pc] * rosterQualityForPlayCall
  }, 0)

  return Math.round(weightedSum / totalWeight)
}
