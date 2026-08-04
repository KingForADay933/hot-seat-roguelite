import type { Player, Team, TeamId } from '../data/types'

function averageOverall(team: Team, playersById: Map<string, Player>): number {
  const roster = team.rosterPlayerIds.map((id) => playersById.get(id)).filter((p): p is Player => p !== undefined)
  if (roster.length === 0) return 0
  return roster.reduce((sum, p) => sum + p.overallRating, 0) / roster.length
}

/**
 * Picks the user's team for a new run: the league's worst roster by average overall rating.
 * Section 2's "no team selection -- the game hands you the hard hand on purpose" doesn't need new
 * generator work (generateLeague's averageOverallShift is league-wide, not per-team) -- generating
 * a normal league and handing the player its worst roster produces the same bad-team-on-purpose
 * result with zero engine changes.
 */
export function pickWorstTeamId(teams: Team[], players: Player[]): TeamId {
  if (teams.length === 0) throw new Error('Cannot assign a team from an empty league')
  const playersById = new Map(players.map((p) => [p.id, p]))
  return teams.reduce((worst, team) => (averageOverall(team, playersById) < averageOverall(worst, playersById) ? team : worst)).id
}
