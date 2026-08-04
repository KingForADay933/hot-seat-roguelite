import type { StandingsRow, Team, TeamId } from '../../data/types'
import { TeamSwatch } from './TeamSwatch'

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
          <th className="numeric">PF</th>
          <th className="numeric">PA</th>
          <th className="numeric">DIFF</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const team = teamById.get(row.teamId)
          const isUserTeam = row.teamId === userTeamId
          return (
            <tr key={row.teamId} className={isUserTeam ? 'user-row' : ''}>
              <td>
                <span className="team-name">
                  {team && <TeamSwatch team={team} />}
                  {team ? `${team.city} ${team.name}` : row.teamId}
                </span>
              </td>
              <td className="numeric text-positive">{row.wins}</td>
              <td className="numeric text-negative">{row.losses}</td>
              <td className="numeric">{row.winPct.toFixed(3)}</td>
              <td className="numeric">{row.pointsFor}</td>
              <td className="numeric">{row.pointsAgainst}</td>
              <td className={`numeric ${row.pointDiff > 0 ? 'text-positive' : row.pointDiff < 0 ? 'text-negative' : ''}`}>
                {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
