import type { DefensiveFit } from '../../run/variation/defenseDraft'

/**
 * One candidate defensive scheme on the reveal screen.
 *
 * Deliberately lighter than SystemChoiceCard, which leads with a synergy number. A defensive scheme
 * reaches the simulation as a shape -- which defender the offense gets to attack, which actions are
 * resisted, how much ball pressure is applied -- rather than as a scalar multiplier, so there is no
 * honest equivalent number to put in that slot. Inventing one would imply a precision the model does
 * not have. What the card shows instead is the trade the scheme makes against *these* players.
 */
export function DefenseChoiceCard({
  fit,
  selected,
  onSelect,
}: {
  fit: DefensiveFit
  selected: boolean
  /** Omitted once the run is locked in, which renders the card as a plain panel -- same reason as
   *  SystemChoiceCard: a button that can't change anything reads as a broken control. */
  onSelect?: () => void
}) {
  const toneClass = fit.tone === 'good' ? 'text-positive' : fit.tone === 'bad' ? 'text-negative' : undefined
  const className = `draft-option system-option${selected ? ' selected' : ''}${onSelect ? '' : ' system-option-locked'}`

  const body = (
    <>
      <span className="system-option-head">
        <strong>{fit.scheme.name}</strong>
      </span>
      <p>{fit.scheme.description}</p>
      <p className={`system-verdict ${toneClass ?? ''}`}>{fit.note}</p>
    </>
  )

  if (!onSelect) return <div className={className}>{body}</div>

  return (
    <button type="button" className={className} onClick={onSelect}>
      {body}
    </button>
  )
}
