import type { Game, GameId, StandingsRow, Team, TeamId } from '../../data/types'

export interface TeamRecord {
  wins: number
  losses: number
}

/**
 * Every team's record as of a given point in the schedule -- counting each played game up to *and
 * including* the named one, in date order.
 *
 * Point-in-time rather than season-to-date because the schedule shows a mix of finished and upcoming
 * games at once: putting today's record beside a game from three weeks ago states a true fact about
 * the wrong moment. Counting through the game means a finished row reads as the record it produced,
 * an upcoming row reads as the record both teams carry into it, and the column simply progresses
 * down the list as a schedule should.
 *
 * A game that isn't in `games` at all yields everyone's record through the whole played schedule,
 * which is the sensible reading of "through a game that hasn't been scheduled".
 */
export function recordsThroughGame(games: Game[], throughGameId: GameId): Map<TeamId, TeamRecord> {
  const chronological = [...games].sort((a, b) => a.date.localeCompare(b.date))
  const cutoff = chronological.findIndex((g) => g.id === throughGameId)
  const upTo = cutoff === -1 ? chronological : chronological.slice(0, cutoff + 1)

  const records = new Map<TeamId, TeamRecord>()
  const recordFor = (teamId: TeamId): TeamRecord => {
    const existing = records.get(teamId)
    if (existing) return existing
    const fresh = { wins: 0, losses: 0 }
    records.set(teamId, fresh)
    return fresh
  }

  for (const game of upTo) {
    if (!game.isPlayed || !game.result) continue
    const home = recordFor(game.homeTeamId)
    const away = recordFor(game.awayTeamId)
    // Same >= comparison computeStandings uses, for the same defensive reason documented there.
    if (game.result.homeScore >= game.result.awayScore) {
      home.wins += 1
      away.losses += 1
    } else {
      away.wins += 1
      home.losses += 1
    }
  }

  return records
}

/**
 * How one team has fared against another, counting only games the two have played each other --
 * `wins`/`losses` are from `teamId`'s side.
 *
 * Season series rather than overall record, because that is the number a GM about to face someone
 * actually wants: a 20-12 opponent you have beaten twice is a different proposition from a 20-12
 * opponent who has swept you. Nothing else needs it, so it stays a separate pass rather than another
 * column on StandingsRow.
 */
export function headToHeadRecord(games: Game[], teamId: TeamId, opponentId: TeamId): TeamRecord {
  const record: TeamRecord = { wins: 0, losses: 0 }

  for (const game of games) {
    if (!game.isPlayed || !game.result) continue
    const isMeeting =
      (game.homeTeamId === teamId && game.awayTeamId === opponentId) ||
      (game.awayTeamId === teamId && game.homeTeamId === opponentId)
    if (!isMeeting) continue

    const isHome = game.homeTeamId === teamId
    const own = isHome ? game.result.homeScore : game.result.awayScore
    const other = isHome ? game.result.awayScore : game.result.homeScore
    // Same >= comparison computeStandings uses, for the same defensive reason documented there.
    if (own >= other) record.wins += 1
    else record.losses += 1
  }

  return record
}

/** Pure function over played games only -- recomputed on demand since league sizes here are small. */
export function computeStandings(teams: Team[], games: Game[]): StandingsRow[] {
  const rows = new Map<TeamId, StandingsRow>(
    teams.map((t) => [t.id, { teamId: t.id, wins: 0, losses: 0, winPct: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 }]),
  )

  for (const game of games) {
    if (!game.isPlayed || !game.result) continue
    const home = rows.get(game.homeTeamId)
    const away = rows.get(game.awayTeamId)
    if (!home || !away) continue

    home.pointsFor += game.result.homeScore
    home.pointsAgainst += game.result.awayScore
    away.pointsFor += game.result.awayScore
    away.pointsAgainst += game.result.homeScore

    // simulateGame now guarantees a decisive winner via overtime (engine/simulateGame.ts), so a
    // tied score should never actually reach this function -- the >= (rather than >) is kept only
    // as a defensive fallback for hand-built fixtures/tests that feed in a tied result directly.
    if (game.result.homeScore >= game.result.awayScore) {
      home.wins += 1
      away.losses += 1
    } else {
      away.wins += 1
      home.losses += 1
    }
  }

  const standings = [...rows.values()].map((row) => {
    const gamesPlayed = row.wins + row.losses
    return {
      ...row,
      winPct: gamesPlayed > 0 ? row.wins / gamesPlayed : 0,
      pointDiff: row.pointsFor - row.pointsAgainst,
    }
  })

  standings.sort((a, b) => b.winPct - a.winPct || b.pointDiff - a.pointDiff)
  return standings
}
