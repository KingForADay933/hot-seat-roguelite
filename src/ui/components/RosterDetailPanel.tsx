import type { AttributeKey, Player, Team } from '../../data/types'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'
import { formatHeight } from '../playerDisplay'
import { splitRoster } from '../rosterGroups'
import { MinutesInput, TrainingFocusSelect } from './RotationControls'

/** How much room a player has left to grow in one attribute before hitting their fixed potential
 *  (engine/development/growPlayerOneSeason.ts's ceiling). Shop camps ignore potential, but every
 *  season-end growth decision runs into it, so it's worth showing next to the current value.
 *
 *  Rounded because season growth writes fractional attributes -- the raw gap reads
 *  "+3.954011440000002". */
function headroom(player: Player, key: (typeof ATTRIBUTE_COLUMNS)[number]['key']): number {
  return Math.max(0, Math.round(player.development.potential[key] - player.attributes[key]))
}

function RosterDetailGroup({
  label,
  players,
  team,
  onSetMinutes,
  onSetFocus,
}: {
  label: string
  players: Player[]
  team: Team
  onSetMinutes: (playerId: string, minutes: number) => void
  onSetFocus: (playerId: string, attribute: AttributeKey | null) => void
}) {
  if (players.length === 0) return null

  return (
    <>
      <h3>{label}</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th className="numeric">Age</th>
              <th className="numeric">Ht</th>
              <th className="numeric">OVR</th>
              <th className="numeric">Min</th>
              <th>Focus</th>
              {ATTRIBUTE_COLUMNS.map((col) => (
                <th key={col.key} className="numeric">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>{player.positions.join('/')}</td>
                <td className="numeric">{player.age}</td>
                <td className="numeric">{formatHeight(player.heightInches)}</td>
                <td className="numeric">{player.overallRating}</td>
                <td className="numeric">
                  <MinutesInput team={team} playerId={player.id} onSetMinutes={onSetMinutes} />
                </td>
                <td>
                  <TrainingFocusSelect team={team} playerId={player.id} onSetFocus={onSetFocus} />
                </td>
                {ATTRIBUTE_COLUMNS.map((col) => {
                  const room = headroom(player, col.key)
                  return (
                    <td key={col.key} className="numeric">
                      {Math.round(player.attributes[col.key])}
                      {room > 0 && <span className="headroom"> +{room}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/**
 * The full per-player attribute sheet behind TeamSummary's group averages -- current rating plus
 * remaining headroom to potential, with rotation minutes and training focus editable inline. Unlike
 * RosterAdjustmentPanel (the same two controls, narrowed to a checkpoint's "respond to the
 * Insights" moment), this is reachable whenever the GM can reach My Team at all.
 */
export function RosterDetailPanel({
  team,
  roster,
  onSetMinutes,
  onSetFocus,
}: {
  team: Team
  roster: Player[]
  onSetMinutes: (playerId: string, minutes: number) => void
  onSetFocus: (playerId: string, attribute: AttributeKey | null) => void
}) {
  const { starters, bench } = splitRoster(team, roster)

  return (
    <>
      <RosterDetailGroup label="Starting Five" players={starters} team={team} onSetMinutes={onSetMinutes} onSetFocus={onSetFocus} />
      <RosterDetailGroup label="Bench" players={bench} team={team} onSetMinutes={onSetMinutes} onSetFocus={onSetFocus} />
    </>
  )
}
