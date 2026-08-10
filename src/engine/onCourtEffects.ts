import type { PlayerId } from '../data/types'
import type { OnCourtPlayer } from './matchup'
import { effectivePlayer } from './positionFit'
import { fatiguedPlayer } from './rotation/fatigue'

/**
 * Every transient shift that stands between the player on the roster and the player who resolves
 * this possession, composed in one place.
 *
 * Two of them so far: the out-of-position penalty for a player charted somewhere that isn't his own
 * slot (positionFit.ts), and tired legs (rotation/fatigue.ts). Applied to a *copy* that reaches
 * possession resolution only -- rotation state, fatigue accrual and the possession log all keep the
 * real players.
 *
 * This is the whole reason neither effect needed plumbing. `selectPlayers`, `computeOffenseStrength`,
 * `computeResistance`, `offensiveReboundProbability` and `pickRebounder` all read `player.attributes`,
 * and `computeConsistencyNoise` reads `player.hidden.consistency`, so handing them an already-adjusted
 * Player propagates both shifts to every one of them without a single new parameter.
 *
 * Lives here rather than in positionFit.ts, where it started. It stopped being about position fit
 * the moment it composed a second effect, and a name that no longer describes what a function does
 * is how the next person ends up adding a third shift somewhere else.
 */
export function effectiveFive(five: OnCourtPlayer[], fatigue?: Map<PlayerId, number>): OnCourtPlayer[] {
  return five.map((entry) => {
    const positionAdjusted = effectivePlayer(entry.player, entry.slot)
    const player = fatigue ? fatiguedPlayer(positionAdjusted, fatigue.get(entry.player.id) ?? 0) : positionAdjusted
    return { slot: entry.slot, player }
  })
}
