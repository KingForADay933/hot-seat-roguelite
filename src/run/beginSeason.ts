import type { Game, League, Player } from '../data/types'
import { generateSchedule } from '../engine/schedule/generateSchedule'
import type { Rng } from '../engine/rng'
import { RUN_SEASON_LENGTH } from './constants'
import type { RunState } from './types'
import { rollWildcardEvent, type WildcardEventOutcome } from './variation/wildcardEvents'

export interface SeasonStart {
  /** The roster with this season's wildcard event already applied -- a real, persisted shift, unlike
   *  the transient consumable boosts in chunkSimContext.ts. */
  players: Player[]
  /** A full unplayed schedule for the season ahead, replacing whatever the previous season left in
   *  the bundle. */
  games: Game[]
  /** Non-null whenever an event actually rolled -- surfaced once, on the season's first checkpoint. */
  wildcardEvent: WildcardEventOutcome | null
}

/**
 * Everything a season needs before any of its games can be played: this season's wildcard event
 * (Tier 3 variation) and its schedule.
 *
 * Hoisted out of simulateSeasonChunk so the schedule exists BEFORE the GM is asked what to do with
 * it. A stretch screen offering "watch this game" has to name the games first, which is impossible
 * while the schedule is only born as a side effect of simming. Callers own the "has this season
 * already begun?" question -- this always rolls fresh, so calling it twice for one season would
 * silently discard the season's results so far.
 *
 * Note the rng draw order (wildcard first, then schedule) matches what simulateSeasonChunk did
 * inline before, so a given seed still produces the same season.
 */
export function beginSeason(run: RunState, league: League, players: Player[], rng: Rng): SeasonStart {
  const rolled = rollWildcardEvent(players, run.teamId, rng)

  return {
    players: rolled.players,
    games: generateSchedule(league.id, league.teamIds, RUN_SEASON_LENGTH, rng),
    wildcardEvent: rolled.outcome,
  }
}
