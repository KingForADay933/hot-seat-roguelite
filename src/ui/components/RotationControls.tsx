import type { AttributeKey, Team } from '../../data/types'
import { REGULATION_MINUTES } from '../../engine/constants'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'
import { currentTrainingFocus } from '../playerDisplay'

/**
 * The two rotation controls, shared by the checkpoint adjustment table and the My Team roster
 * sheet -- both write through the same setRotationMinutes/setTrainingFocus, so they need to look
 * and behave identically wherever the GM happens to be when they change their mind.
 */
export function MinutesInput({
  team,
  playerId,
  onSetMinutes,
}: {
  team: Team
  playerId: string
  onSetMinutes: (playerId: string, minutes: number) => void
}) {
  return (
    <input
      type="number"
      min={0}
      max={REGULATION_MINUTES}
      // Auto-generated targets are unrounded thirds/seventeenths of 48; setRotationMinutes rounds
      // on write anyway, so showing the rounded value is what the GM is actually editing.
      value={Math.round(team.rotationMinutes[playerId] ?? 0)}
      onChange={(e) => onSetMinutes(playerId, Number(e.target.value))}
      style={{ width: '4em' }}
    />
  )
}

export function TrainingFocusSelect({
  team,
  playerId,
  onSetFocus,
}: {
  team: Team
  playerId: string
  onSetFocus: (playerId: string, attribute: AttributeKey | null) => void
}) {
  return (
    <select
      value={currentTrainingFocus(team, playerId) ?? ''}
      onChange={(e) => onSetFocus(playerId, (e.target.value || null) as AttributeKey | null)}
    >
      <option value="">Auto</option>
      {ATTRIBUTE_COLUMNS.map((col) => (
        <option key={col.key} value={col.key}>
          {col.label}
        </option>
      ))}
    </select>
  )
}
