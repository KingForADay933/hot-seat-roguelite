import type { OffensivePlaybook } from '../../data/presets'
import type { PlayCallType } from '../../data/types'
import { SYNERGY_NEUTRAL } from '../../engine/constants'
import { synergyMultiplier } from '../../engine/possession/possessionStrength'
import type { PlayCallFit } from '../../run/variation/systemDraft'

const PLAY_CALL_LABELS: Record<PlayCallType, string> = {
  'pick-and-roll': 'Pick & Roll',
  isolation: 'Isolation',
  'post-up': 'Post-Up',
  'spot-up': 'Spot-Up',
  cutting: 'Cutting',
  transition: 'Transition',
}

/** "+7" / "-4" / "even" against SYNERGY_NEUTRAL, the score at which the multiplier is exactly 1.0. */
function formatDelta(synergy: number): string {
  const delta = synergy - SYNERGY_NEUTRAL
  if (delta === 0) return 'even'
  return delta > 0 ? `+${delta}` : `${delta}`
}

/**
 * One candidate system on the reveal screen, showing what the roster actually does with it: the
 * synergy score it would lock in, the resulting offense multiplier (the number the sim consumes),
 * and the play-call-by-play-call breakdown of where that score comes from -- a heavy weight over a
 * low roster quality is the drag, and the bar makes that visible without reading the math.
 */
export function SystemChoiceCard({
  playbook,
  synergy,
  breakdown,
  selected,
  onSelect,
}: {
  playbook: OffensivePlaybook
  synergy: number
  breakdown: PlayCallFit[]
  selected: boolean
  /** Omitted once the system is locked in, which renders the card as a plain panel -- a button
   *  that looks pressable but can't change anything reads as a broken control. */
  onSelect?: () => void
}) {
  const delta = synergy - SYNERGY_NEUTRAL
  const multiplier = synergyMultiplier(synergy)
  const deltaClass = delta > 0 ? 'text-positive' : delta < 0 ? 'text-negative' : undefined
  const className = `draft-option system-option${selected ? ' selected' : ''}${onSelect ? '' : ' system-option-locked'}`

  const body = (
    <>
      <span className="system-option-head">
        <strong>{playbook.name}</strong>
        <span className={`system-synergy ${deltaClass ?? ''}`}>{synergy}</span>
      </span>
      <p>{playbook.description}</p>
      <p className={`system-verdict ${deltaClass ?? ''}`}>
        {formatDelta(synergy)} vs. neutral &middot; offense &times;{multiplier.toFixed(3)}
      </p>
      <span className="playcall-bars">
        {breakdown.map((fit) => (
          <span key={fit.playCall} className="playcall-row">
            <span className="playcall-label">{PLAY_CALL_LABELS[fit.playCall]}</span>
            <span className="playcall-weight">{Math.round(fit.weight * 100)}%</span>
            <span className="playcall-track">
              <span className="playcall-fill" style={{ width: `${fit.rosterQuality}%` }} />
            </span>
            {/* The delta, not the raw quality, is what moves the score -- a roster that grades 70
                everywhere is neutral no matter how the system weights the calls. */}
            <span className={`playcall-quality ${fit.vsBaseline > 0 ? 'text-positive' : fit.vsBaseline < 0 ? 'text-negative' : ''}`}>
              {fit.vsBaseline > 0 ? `+${fit.vsBaseline}` : fit.vsBaseline}
            </span>
          </span>
        ))}
      </span>
    </>
  )

  if (!onSelect) return <div className={className}>{body}</div>

  return (
    <button type="button" className={className} onClick={onSelect}>
      {body}
    </button>
  )
}
