import { TACTICAL_FOCUS_DIALS } from '../../data/presets'
import { BALANCED_FOCUS, type TacticalFocus } from '../../data/types'

type DialKey = keyof TacticalFocus

/**
 * The four tactical dials, as controls rather than cards.
 *
 * Same reasoning as DefensiveSchemeSelect, and deliberately the same shape: these live on busy
 * screens beside a dozen other things, and four grids of three paragraphs would drown out whatever
 * the GM came to that screen to do. The chosen option's description sits beside the select so the
 * trade it makes is still on screen -- which matters more here than for the scheme, because a dial
 * whose downside is invisible reads as a free upgrade.
 *
 * `side` groups each dial under the end of the floor it belongs to, so the fixed thing (system,
 * scheme) and the live one (its dials) read as a pair.
 */
export function TacticalFocusControls({
  focus,
  onChange,
  side,
  disabled,
}: {
  /** Undefined for a team that has never touched a dial -- read as all-balanced. */
  focus: TacticalFocus | undefined
  onChange: (focus: Partial<TacticalFocus>) => void
  side: 'offense' | 'defense'
  disabled?: boolean
}) {
  const current: TacticalFocus = { ...BALANCED_FOCUS, ...focus }
  const keys = (Object.keys(TACTICAL_FOCUS_DIALS) as DialKey[]).filter((key) => TACTICAL_FOCUS_DIALS[key].side === side)

  return (
    <>
      {keys.map((key) => {
        const dial = TACTICAL_FOCUS_DIALS[key]
        const selected = dial.options.find((option) => option.id === current[key])
        return (
          <p key={key}>
            <strong>{dial.label}:</strong>{' '}
            <select
              value={current[key]}
              disabled={disabled}
              aria-label={dial.label}
              onChange={(e) => onChange({ [key]: e.target.value } as Partial<TacticalFocus>)}
            >
              {dial.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {selected && ` -- ${selected.description}`}
          </p>
        )
      })}
    </>
  )
}
