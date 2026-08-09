import type { League, TeamId } from '../data/types'
import { hasHitTarget, targetForStretch } from './target'
import type { RunState } from './types'

/**
 * The run's story, reconstructed at its end.
 *
 * **Built from retained standings, not from possession detail.** Coaching Insights are derived from
 * possession logs, and those are discarded as each chunk resolves (Tier 1.5's payload fix) -- by the
 * time a run ends there is nothing left to derive a play-level narrative from. What *does* survive
 * every rollover is `League.seasonHistory`: one row of final standings per completed season, kept
 * deliberately for exactly this kind of retrospective.
 *
 * That turns out to be the better source anyway. Insights explain a game ("pulled with heavy
 * fatigue"); a run's ending is a question about seasons -- which target you missed, by how much, and
 * whether you were ever close.
 *
 * The one thing standings don't record is which stretch a season belonged to, or what the bar was at
 * the time, since the target tightens as stretches clear. Both are recoverable: the state machine is
 * deterministic, so replaying evaluateSeasonEnd's rules forward over the retained standings
 * reconstructs the whole arc. Kept in step with runState.ts's own transitions -- if the escalation
 * rules change there, this replay has to change with them.
 */

export interface SeasonRecap {
  seasonNumber: number
  /** Which stretch this season belonged to, and which attempt within it. */
  stretchNumber: number
  seasonInStretch: number
  /** The bar as it stood that season -- tighter in later stretches. */
  targetRankFraction: number
  /** That fraction resolved against the league size: finish this high or better. */
  targetRank: number
  rank: number
  wins: number
  losses: number
  pointDiff: number
  hitTarget: boolean
  /** Wins behind the team that held the last qualifying place. 0 when the target was hit. The
   *  honest "how close was it" number -- ties break on point differential, so matching this exactly
   *  wouldn't have guaranteed the spot, but it's the gap that mattered. */
  winsShort: number
}

export interface RunSummary {
  seasons: SeasonRecap[]
  /** Stretches fully cleared -- the run's real score. */
  stretchesCleared: number
  /** Best finish of the run, by rank then by record. Null on a run with no completed seasons. */
  bestSeason: SeasonRecap | null
  /** The season that ran out the last chance, when the run ended in a firing. */
  firedIn: SeasonRecap | null
  /** The miss that came closest, across the whole run. Null if nothing was ever missed. */
  closestMiss: SeasonRecap | null
  /** Every season's win total added up -- the "how much did you actually win" line. */
  totalWins: number
  totalLosses: number
}

/**
 * Wins behind the last qualifying place. Standings arrive best-to-worst (computeStandings'
 * contract), so the team holding the cutoff is at index targetRank - 1.
 */
function winsBehindCutoff(standings: { teamId: TeamId; wins: number }[], teamId: TeamId, targetRank: number): number {
  const cutoff = standings[targetRank - 1]
  const own = standings.find((row) => row.teamId === teamId)
  if (!cutoff || !own) return 0
  return Math.max(0, cutoff.wins - own.wins)
}

export function buildRunSummary(run: RunState, league: League): RunSummary {
  const seasons: SeasonRecap[] = []

  // Replays runState.ts's evaluateSeasonEnd forward: clearing the target escalates immediately and
  // resets the attempt counter, missing burns one of the stretch's chances.
  let stretchNumber = 1
  let seasonInStretch = 1

  for (const summary of league.seasonHistory) {
    const target = targetForStretch(stretchNumber)
    const standings = summary.standings
    const rank = standings.findIndex((row) => row.teamId === run.teamId) + 1
    // A season whose standings don't include the run's team can't be described; skip rather than
    // throw, so one malformed row can't take down the whole end-of-run screen.
    if (rank === 0) continue

    const own = standings[rank - 1]
    const targetRank = Math.ceil(standings.length * target.rankFraction)
    const hitTarget = hasHitTarget(standings, run.teamId, target)

    seasons.push({
      seasonNumber: summary.seasonNumber,
      stretchNumber,
      seasonInStretch,
      targetRankFraction: target.rankFraction,
      targetRank,
      rank,
      wins: own.wins,
      losses: own.losses,
      pointDiff: own.pointDiff,
      hitTarget,
      winsShort: hitTarget ? 0 : winsBehindCutoff(standings, run.teamId, targetRank),
    })

    if (hitTarget) {
      stretchNumber += 1
      seasonInStretch = 1
    } else {
      seasonInStretch += 1
    }
  }

  const misses = seasons.filter((s) => !s.hitTarget)
  const bestSeason = seasons.reduce<SeasonRecap | null>((best, s) => {
    if (!best) return s
    if (s.rank !== best.rank) return s.rank < best.rank ? s : best
    return s.wins > best.wins ? s : best
  }, null)

  return {
    seasons,
    stretchesCleared: run.stretchNumber - 1,
    bestSeason,
    // The firing is always the last season played -- evaluateSeasonEnd only fires on a miss with no
    // chances left, which is necessarily the most recent one.
    firedIn: run.status === 'fired' ? (seasons[seasons.length - 1] ?? null) : null,
    closestMiss: misses.reduce<SeasonRecap | null>((closest, s) => {
      if (!closest) return s
      return s.winsShort < closest.winsShort ? s : closest
    }, null),
    totalWins: seasons.reduce((sum, s) => sum + s.wins, 0),
    totalLosses: seasons.reduce((sum, s) => sum + s.losses, 0),
  }
}
