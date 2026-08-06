import type { AttributeKey, Player, Team } from '../../data/types'
import { POSITION_ORDER } from '../../engine/matchup'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'

/** The single focused attribute this UI wrote for a player, if any -- setTrainingFocus (RunProvider)
 *  only ever writes a single-key override, so the first key is always the whole answer. */
function currentFocus(team: Team, playerId: string): AttributeKey | null {
  const override = team.trainingFocus[playerId]
  if (!override) return null
  const keys = Object.keys(override) as AttributeKey[]
  return keys[0] ?? null
}

function RosterGroupTable({
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
    <div className="table-scroll">
      <h3>{label}</h3>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th className="numeric">Minutes</th>
            <th>Training Focus</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td>{player.name}</td>
              <td className="numeric">
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={team.rotationMinutes[player.id] ?? 0}
                  onChange={(e) => onSetMinutes(player.id, Number(e.target.value))}
                  style={{ width: '4em' }}
                />
              </td>
              <td>
                <select
                  value={currentFocus(team, player.id) ?? ''}
                  onChange={(e) => onSetFocus(player.id, (e.target.value || null) as AttributeKey | null)}
                >
                  <option value="">Auto</option>
                  {ATTRIBUTE_COLUMNS.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RosterAdjustmentPanel({
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
  // Same Starters/Bench split as TeamSummary -- a flat, intertwined roster list read as confusing
  // to scan at a glance during playtesting (Tier 2).
  const starters = team.startingFive
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined)
    .sort((a, b) => POSITION_ORDER.indexOf(a.positions[0]) - POSITION_ORDER.indexOf(b.positions[0]))

  const starterIds = new Set(starters.map((p) => p.id))
  const bench = roster.filter((p) => !starterIds.has(p.id))

  return (
    <>
      <RosterGroupTable label="Starters" players={starters} team={team} onSetMinutes={onSetMinutes} onSetFocus={onSetFocus} />
      <RosterGroupTable label="Bench" players={bench} team={team} onSetMinutes={onSetMinutes} onSetFocus={onSetFocus} />
    </>
  )
}
