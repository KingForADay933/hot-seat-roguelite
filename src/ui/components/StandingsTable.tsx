import type { StandingsRow, Team, TeamId } from '../../data/types'
import { TeamName } from './TeamName'

/** Average scoring margin, signed, to one decimal -- or a dash before anyone has played, where
 *  "+0.0" would claim an evenly-matched season that hasn't happened. */
function formatMargin(row: StandingsRow): string {
  const gamesPlayed = row.wins + row.losses
  if (gamesPlayed === 0) return '--'
  const margin = row.pointDiff / gamesPlayed
  return `${margin > 0 ? '+' : ''}${margin.toFixed(1)}`
}

export function StandingsTable({
  rows,
  teams,
  userTeamId,
}: {
  rows: StandingsRow[]
  teams: Team[]
  userTeamId?: TeamId | null
}) {
  const teamById = new Map(teams.map((t) => [t.id, t]))

  return (
    <table>
      <thead>
        <tr>
          <th>Team</th>
          <th className="numeric">W</th>
          <th className="numeric">L</th>
          <th className="numeric">PCT</th>
          <th className="numeric" title="Points scored, all season">
            PF
          </th>
          <th className="numeric" title="Points allowed, all season">
            PA
          </th>
          {/* Per game, not cumulative. A cumulative +97 means nothing without knowing how many
              games it took, and the per-game figure is the form the number is actually intuitive
              in -- "+3.2 a night" is a sentence, "+97" is arithmetic homework. The tooltip exists
              because a winning record beside a negative differential reads as a bug otherwise: it
              is real (you won close and lost badly), it happens to about 3% of teams, and nothing
              on this screen said so. */}
          <th className="numeric" title="Average scoring margin per game (points scored minus points allowed). A team can win close games and lose badly, so a winning record with a negative margin is normal.">
            MARGIN
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const team = teamById.get(row.teamId)
          const isUserTeam = row.teamId === userTeamId
          return (
            <tr key={row.teamId} className={isUserTeam ? 'user-row' : ''}>
              <td>
                {/* Clickable through to a scouting report -- the standings is where a GM looks at
                    the rest of the league, so it is where "who are these people" should be
                    answerable. Their own row goes there too rather than being a dead spot. */}
                <TeamName team={team} fallback={row.teamId} />
              </td>
              <td className="numeric text-positive">{row.wins}</td>
              <td className="numeric text-negative">{row.losses}</td>
              <td className="numeric">{row.winPct.toFixed(3)}</td>
              <td className="numeric">{row.pointsFor}</td>
              <td className="numeric">{row.pointsAgainst}</td>
              <td
                className={`numeric ${row.pointDiff > 0 ? 'text-positive' : row.pointDiff < 0 ? 'text-negative' : ''}`}
                title={`${row.pointDiff > 0 ? '+' : ''}${row.pointDiff} across ${row.wins + row.losses} games`}
              >
                {formatMargin(row)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
