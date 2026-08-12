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
  targetRank,
}: {
  rows: StandingsRow[]
  teams: Team[]
  userTeamId?: TeamId | null
  /** Finish at or above this rank or the run ends. Draws the qualifying line under it -- the table's
   *  only real question is whether you are on the right side of that, and until this was passed in it
   *  had no way to say. Omitted where there is no target to speak of (a scouting report, say). */
  targetRank?: number
}) {
  const teamById = new Map(teams.map((t) => [t.id, t]))

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="numeric standings-rank">#</th>
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
          {rows.map((row, index) => {
            const team = teamById.get(row.teamId)
            const isUserTeam = row.teamId === userTeamId
            const classNames = [isUserTeam ? 'user-row' : '']
            // The rule goes under the last qualifying team, so the gap between "safe" and "fired" is
            // a line you can see rather than a percentage you have to do arithmetic on.
            if (targetRank !== undefined && index + 1 === targetRank) classNames.push('standings-cut')
            return (
              <tr key={row.teamId} className={classNames.filter(Boolean).join(' ')}>
                <td className="numeric standings-rank">{index + 1}</td>
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
    </div>
  )
}
