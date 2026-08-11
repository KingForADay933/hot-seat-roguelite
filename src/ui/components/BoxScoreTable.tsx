import type { Player, PlayerBoxScoreLine } from '../../data/types'
import { PlayerName } from './PlayerName'

export function BoxScoreTable({ lines, players }: { lines: PlayerBoxScoreLine[]; players: Player[] }) {
  const playerById = new Map(players.map((p) => [p.id, p]))
  const sortedLines = [...lines].sort((a, b) => b.minutesPlayed - a.minutesPlayed)

  // Wrapped, like every other wide table in the app. Twelve columns do not fit a narrow window, and
  // without this the table widened the *page* instead of scrolling inside itself -- 577px of content
  // in a 375px viewport, which inflated the layout viewport and broke sizing for anything trying to
  // measure against it.
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th className="numeric">MIN</th>
            <th className="numeric">PTS</th>
            <th className="numeric">FG</th>
            <th className="numeric">3P</th>
            <th className="numeric">FT</th>
            <th className="numeric">AST</th>
            <th className="numeric">REB</th>
            <th className="numeric">STL</th>
            <th className="numeric">BLK</th>
            <th className="numeric">TO</th>
            <th className="numeric">PF</th>
          </tr>
        </thead>
        <tbody>
          {sortedLines.map((line) => (
            <tr key={line.playerId}>
              <td>
                <PlayerName playerId={line.playerId} name={playerById.get(line.playerId)?.name ?? line.playerId} />
              </td>
              <td className="numeric">{Math.round(line.minutesPlayed)}</td>
              <td className="numeric">{line.points}</td>
              <td className="numeric">
                {line.fieldGoalsMade}-{line.fieldGoalsAttempted}
              </td>
              <td className="numeric">
                {line.threePointersMade}-{line.threePointersAttempted}
              </td>
              <td className="numeric">
                {line.freeThrowsMade}-{line.freeThrowsAttempted}
              </td>
              <td className="numeric">{line.assists}</td>
              <td className="numeric">{line.rebounds}</td>
              <td className="numeric">{line.steals}</td>
              <td className="numeric">{line.blocks}</td>
              <td className="numeric">{line.turnovers}</td>
              <td className="numeric">{line.fouls}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
