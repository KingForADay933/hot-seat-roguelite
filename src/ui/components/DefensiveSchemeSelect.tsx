import { DEFENSIVE_SCHEMES, type DefensiveSchemeId } from '../../data/presets'

/**
 * The team's standing defensive scheme, as a control rather than a set of cards.
 *
 * The reveal screen's DefenseChoiceCard grid is the right shape for the opening decision, where the
 * GM is meeting the roster and comparing five options at length. Everywhere the scheme can be
 * *changed* -- a checkpoint, My Team, a live broadcast -- it is one setting among many on a busy
 * screen, and five paragraphs of card would drown out whatever the GM actually came there to do.
 * Same value, same writer, different amount of room.
 */
export function DefensiveSchemeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (schemeId: DefensiveSchemeId) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as DefensiveSchemeId)}
      aria-label="Defensive scheme"
    >
      {(Object.keys(DEFENSIVE_SCHEMES) as DefensiveSchemeId[]).map((id) => (
        <option key={id} value={id}>
          {DEFENSIVE_SCHEMES[id].name}
        </option>
      ))}
    </select>
  )
}
