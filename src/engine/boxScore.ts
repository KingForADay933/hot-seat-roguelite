import type { Game, GameResult, PlayCallType, PlayerBoxScoreLine, PlayerId, PossessionLogEntry, TeamId } from '../data/types'
import { SECONDS_PER_MINUTE } from './constants'

/** Pass-originated play calls where a make credits an assist to secondaries[0]. Other play calls
 *  (Pick-and-Roll, Isolation, Post-Up, Transition) are modeled as the primary scoring unassisted --
 *  a deliberate MVP simplification since there's no live off-ball movement model to attribute otherwise.
 *  Exported so the simcast's running box score credits assists by the same rule this one does,
 *  rather than a copy that could drift. */
export const ASSIST_ELIGIBLE_PLAY_CALLS: PlayCallType[] = ['spot-up', 'cutting']

function emptyLine(playerId: PlayerId): PlayerBoxScoreLine {
  return {
    playerId,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    assists: 0,
    rebounds: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    minutesPlayed: 0,
  }
}

/**
 * Derived entirely from the possession log -- the log is the sole source of truth for who was on
 * the floor, including for substitutions, and now for who grabbed each rebound.
 *
 * A pure function of the log. It used to take an `Rng` solely to roll the rebounder, which made the
 * official box score non-deterministic with respect to the log it was derived from: the same log
 * could produce two different rebound columns. Now the same log always produces the same box score,
 * which is what lets the simcast's running tally and the final table agree by construction rather
 * than by coincidence.
 */
export function deriveBoxScore(
  possessionLog: PossessionLogEntry[],
  homeTeamId: TeamId,
): GameResult {
  const lines = new Map<PlayerId, PlayerBoxScoreLine>()
  const lineFor = (id: PlayerId): PlayerBoxScoreLine => {
    let line = lines.get(id)
    if (!line) {
      line = emptyLine(id)
      lines.set(id, line)
    }
    return line
  }

  const homeIds = new Set<PlayerId>()
  const awayIds = new Set<PlayerId>()
  /** Real game seconds on the floor, summed from each possession's own duration -- no longer a
   *  possession count scaled by a nominal pace, so an overtime game simply reports more than 48. */
  const secondsOnCourt = new Map<PlayerId, number>()
  const bumpOnCourt = (id: PlayerId, seconds: number) => secondsOnCourt.set(id, (secondsOnCourt.get(id) ?? 0) + seconds)

  let homeScore = 0
  let awayScore = 0

  for (const entry of possessionLog) {
    entry.homeOnCourt.forEach(({ playerId }) => {
      homeIds.add(playerId)
      bumpOnCourt(playerId, entry.durationSeconds)
      lineFor(playerId)
    })
    entry.awayOnCourt.forEach(({ playerId }) => {
      awayIds.add(playerId)
      bumpOnCourt(playerId, entry.durationSeconds)
      lineFor(playerId)
    })

    const offenseIsHome = entry.offenseTeamId === homeTeamId
    const primaryLine = lineFor(entry.primaryPlayerId)

    if (entry.outcome === 'make') {
      primaryLine.points += entry.pointsScored
      primaryLine.fieldGoalsMade += 1
      primaryLine.fieldGoalsAttempted += 1
      if (entry.pointsScored === 3) {
        primaryLine.threePointersMade += 1
        primaryLine.threePointersAttempted += 1
      }
      if (ASSIST_ELIGIBLE_PLAY_CALLS.includes(entry.playCallUsed) && entry.secondaryPlayerIds[0]) {
        lineFor(entry.secondaryPlayerIds[0]).assists += 1
      }
      if (offenseIsHome) homeScore += entry.pointsScored
      else awayScore += entry.pointsScored
    } else if (entry.outcome === 'miss') {
      primaryLine.fieldGoalsAttempted += 1
      if (entry.isThreePointAttempt) primaryLine.threePointersAttempted += 1

      // Both which side got the board and which player came down with it are the simulation's
      // decisions, read straight off the log. The rebounder used to be rolled here instead, which
      // meant the official box score and anything watching the game live could disagree about who
      // got it; now there is one answer, settled when the possession happened.
      if (entry.rebounderId) lineFor(entry.rebounderId).rebounds += 1
      // A blocked shot is still the shooter's missed attempt above -- this only adds the defender's credit.
      if (entry.blockedById) lineFor(entry.blockedById).blocks += 1
    } else if (entry.outcome === 'turnover') {
      primaryLine.turnovers += 1
      // Only forced turnovers have someone to credit, so steals are always fewer than turnovers.
      if (entry.stolenById) lineFor(entry.stolenById).steals += 1
    } else if (entry.outcome === 'foul') {
      // The whistle lands on the offensive player who drew it, not a defender's personal foul count
      // -- there's still no defensive foul attribution model. The free throws it produced do score.
      primaryLine.fouls += 1
      primaryLine.freeThrowsMade += entry.freeThrowsMade
      primaryLine.freeThrowsAttempted += entry.freeThrowsAttempted
      primaryLine.points += entry.pointsScored
      if (offenseIsHome) homeScore += entry.pointsScored
      else awayScore += entry.pointsScored
    }
  }

  lines.forEach((line, id) => {
    line.minutesPlayed = (secondsOnCourt.get(id) ?? 0) / SECONDS_PER_MINUTE
  })

  const allLines = [...lines.values()]

  return {
    homeScore,
    awayScore,
    // Set by simulateGame once it knows whether the game actually went to overtime -- deriveBoxScore
    // only sees the possession log, not the game-level outcome.
    overtimePeriods: 0,
    boxScore: {
      home: allLines.filter((l) => homeIds.has(l.playerId)),
      away: allLines.filter((l) => awayIds.has(l.playerId)),
    },
  }
}

export interface SeasonTotals {
  gamesPlayed: number
  points: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  assists: number
  rebounds: number
  steals: number
  blocks: number
  turnovers: number
  fouls: number
  minutesPlayed: number
}

function emptySeasonTotals(): SeasonTotals {
  return {
    gamesPlayed: 0,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    assists: 0,
    rebounds: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    minutesPlayed: 0,
  }
}

/** Sums every played game's box score lines per player this season -- bundle.games only ever holds
 *  the current season's games (rolling window, Section 6), so no extra date filtering is needed. */
export function aggregateSeasonTotals(games: Game[]): Map<PlayerId, SeasonTotals> {
  const totals = new Map<PlayerId, SeasonTotals>()

  for (const game of games) {
    if (!game.isPlayed || !game.result) continue
    for (const line of [...game.result.boxScore.home, ...game.result.boxScore.away]) {
      const current = totals.get(line.playerId) ?? emptySeasonTotals()
      current.gamesPlayed += 1
      current.points += line.points
      current.fieldGoalsMade += line.fieldGoalsMade
      current.fieldGoalsAttempted += line.fieldGoalsAttempted
      current.threePointersMade += line.threePointersMade
      current.threePointersAttempted += line.threePointersAttempted
      current.freeThrowsMade += line.freeThrowsMade
      current.freeThrowsAttempted += line.freeThrowsAttempted
      current.assists += line.assists
      current.rebounds += line.rebounds
      current.steals += line.steals
      current.blocks += line.blocks
      current.turnovers += line.turnovers
      current.fouls += line.fouls
      current.minutesPlayed += line.minutesPlayed
      totals.set(line.playerId, current)
    }
  }

  return totals
}
