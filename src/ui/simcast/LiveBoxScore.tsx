import type { Player, PlayerId } from '../../data/types'
import type { LiveBoxScoreLine } from './playbackState'

/**
 * The running box score for one team. Mirrors BoxScoreTable's columns except REB, which the
 * possession log can't determine mid-game (see LiveBoxScoreLine) -- the column stays in place,
 * dashed, so the swap to the real box score at the buzzer doesn't shift the table underneath the
 * GM's eyes.
 */
export function LiveBoxScore({
  roster,
  lines,
}: {
  roster: Player[]
  lines: Map<PlayerId, LiveBoxScoreLine>
}) {
  const rows = roster
    .map((player) => ({ player, line: lines.get(player.id) }))
    .filter((row): row is { player: Player; line: LiveBoxScoreLine } => row.line !== undefined)
    .sort((a, b) => b.line.minutesPlayed - a.line.minutesPlayed)

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
            <th className="numeric">TO</th>
            <th className="numeric">PF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, line }) => (
            <tr key={player.id}>
              <td>{player.name}</td>
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
              <td className="numeric" title="Rebounds are attributed once the game ends">
                —
              </td>
              <td className="numeric">{line.turnovers}</td>
              <td className="numeric">{line.fouls}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
