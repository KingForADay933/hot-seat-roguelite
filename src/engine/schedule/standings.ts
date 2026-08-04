import type { Game, StandingsRow, Team, TeamId } from '../../data/types'

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
