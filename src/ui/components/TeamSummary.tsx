import type { Player, StandingsRow, Team } from '../../data/types'
import { POSITION_ORDER } from '../../engine/matchup'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
}

/** ".625", or "1.000" for an undefeated team -- real-basketball win-pct notation. */
function formatWinPct(pct: number): string {
  if (pct >= 1) return '1.000'
  return `.${Math.round(pct * 1000).toString().padStart(3, '0')}`
}

export function TeamSummary({ team, roster, record }: { team: Team; roster: Player[]; record?: StandingsRow }) {
  const starters = team.startingFive
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined)
    .sort((a, b) => POSITION_ORDER.indexOf(a.positions[0]) - POSITION_ORDER.indexOf(b.positions[0]))

  const starterIds = new Set(starters.map((p) => p.id))
  const bench = roster.filter((p) => !starterIds.has(p.id))
  const groups: { label: string; players: Player[] }[] = [
    { label: 'Starting Five', players: starters },
    { label: 'Bench', players: bench },
  ]

  const gamesPlayed = record ? record.wins + record.losses : 0
  const recordClass = !record || gamesPlayed === 0 ? undefined : record.winPct > 0.5 ? 'text-positive' : record.winPct < 0.5 ? 'text-negative' : undefined

  return (
    <div className="team-summary">
      <p>
        Record: <span className={recordClass}>{record ? `${record.wins}-${record.losses}` : '0-0'}</span>
        {record && gamesPlayed > 0 && ` (${formatWinPct(record.winPct)})`}
      </p>
      <p>Starting Five: {starters.length > 0 ? starters.map((p) => `${p.positions[0]} ${p.name}`).join(', ') : 'Not set'}</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Avg</th>
              <th className="numeric">OVR</th>
              {ATTRIBUTE_COLUMNS.map((col) => (
                <th key={col.key} className="numeric">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.label}>
                <td>{group.label}</td>
                <td className="numeric">{Math.round(average(group.players.map((p) => p.overallRating)))}</td>
                {ATTRIBUTE_COLUMNS.map((col) => (
                  <td key={col.key} className="numeric">
                    {Math.round(average(group.players.map((p) => p.attributes[col.key])))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
