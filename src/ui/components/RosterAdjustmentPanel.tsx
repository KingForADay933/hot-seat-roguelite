import type { AttributeKey, Player, Team } from '../../data/types'
import { splitRoster } from '../rosterGroups'
import { PlayerName } from './PlayerName'
import { MinutesInput, PositionMinutesSummary, TrainingFocusSelect } from './RotationControls'

function RosterAdjustmentGroup({
  label,
  players,
  team,
  roster,
  onSetMinutes,
  onSetFocus,
}: {
  label: string
  players: Player[]
  team: Team
  roster: Player[]
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
              <td>
                <PlayerName playerId={player.id} name={player.name} />
              </td>
              <td className="numeric">
                <MinutesInput team={team} roster={roster} playerId={player.id} onSetMinutes={onSetMinutes} />
              </td>
              <td>
                <TrainingFocusSelect team={team} playerId={player.id} onSetFocus={onSetFocus} />
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
  // Listing all ~10-13 roster players in one undifferentiated table read as confusing (playtesting
  // feedback); grouping under two headers matches how a GM actually thinks about the roster.
  const { starters, bench } = splitRoster(team, roster)

  return (
    <>
      <PositionMinutesSummary team={team} roster={roster} />
      <RosterAdjustmentGroup
        label="Starting Five"
        players={starters}
        team={team}
        roster={roster}
        onSetMinutes={onSetMinutes}
        onSetFocus={onSetFocus}
      />
      <RosterAdjustmentGroup
        label="Bench"
        players={bench}
        team={team}
        roster={roster}
        onSetMinutes={onSetMinutes}
        onSetFocus={onSetFocus}
      />
    </>
  )
}
