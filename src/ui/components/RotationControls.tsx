import type { AttributeKey, Player, Team } from '../../data/types'
import { maxMinutesFor, minMinutesFor, positionMinutesSummary, POSITION_MINUTES_BUDGET } from '../../run/minutesBudget'
import type { HouseRuleId } from '../../run/variation/houseRules'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'
import { currentTrainingFocus } from '../playerDisplay'

/**
 * The two rotation controls, shared by the checkpoint adjustment table and the My Team roster
 * sheet -- both write through the same setRotationMinutes/setTrainingFocus, so they need to look
 * and behave identically wherever the GM happens to be when they change their mind.
 */
export function MinutesInput({
  team,
  roster,
  playerId,
  houseRule,
  onSetMinutes,
}: {
  team: Team
  roster: Player[]
  playerId: string
  houseRule: HouseRuleId
  onSetMinutes: (playerId: string, minutes: number) => void
}) {
  // Capped by what's left at this player's position, not a flat 48, and narrowed again by any house
  // rule that caps or floors minutes -- setRotationMinutes clamps to the same window on write
  // (run/minutesBudget.ts), so the spinner stops exactly where the write would.
  const max = maxMinutesFor(team, roster, playerId, houseRule)
  const min = minMinutesFor(roster, playerId, houseRule)
  const position = roster.find((p) => p.id === playerId)?.positions[0]
  const budgetNote = `${position}'s ${POSITION_MINUTES_BUDGET} less what his positional teammates hold`
  return (
    <input
      type="number"
      min={min}
      max={max}
      title={min > 0 ? `${min}-${max} min — ${budgetNote}, and your house rule keeps him in the rotation` : `Up to ${max} min — ${budgetNote}`}
      // Auto-generated targets are unrounded thirds/seventeenths of 48; setRotationMinutes rounds
      // on write anyway, so showing the rounded value is what the GM is actually editing.
      value={Math.round(team.rotationMinutes[playerId] ?? 0)}
      onChange={(e) => onSetMinutes(playerId, Number(e.target.value))}
      style={{ width: '4em' }}
    />
  )
}

/**
 * How each position's 48 minutes are currently spent -- shown above whichever minutes table the GM
 * is editing, so an input that refuses to go higher reads as "that time is already committed"
 * rather than as a stuck control. Raising one player means lowering a teammate at his position.
 */
export function PositionMinutesSummary({ team, roster }: { team: Team; roster: Player[] }) {
  const summary = positionMinutesSummary(team, roster)

  return (
    <p className="position-minutes">
      <strong>Minutes by position:</strong>{' '}
      {summary.map(({ position, assigned, remaining, isOverBudget }, i) => (
        <span key={position} className={isOverBudget ? 'text-negative' : undefined}>
          {i > 0 && ' · '}
          {position} {Math.round(assigned)}/{POSITION_MINUTES_BUDGET}
          {remaining > 0 && <span className="headroom"> +{Math.round(remaining)} free</span>}
        </span>
      ))}
    </p>
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
