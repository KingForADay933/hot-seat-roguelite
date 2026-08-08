import type { OnCourtRecord, Player, PlayerId } from '../../data/types'
import { FATIGUE_EMERGENCY_THRESHOLD, FATIGUE_SUB_IN_MAX, FATIGUE_SUB_OUT_THRESHOLD } from '../../engine/constants'
import { POSITION_ORDER } from '../../engine/matchup'

/** PG through C, so the five reads like a lineup card and a substitution doesn't reorder the list. */
function sortBySlotOrder(onCourt: OnCourtRecord[]): OnCourtRecord[] {
  return [...onCourt].sort((a, b) => POSITION_ORDER.indexOf(a.slot) - POSITION_ORDER.indexOf(b.slot))
}

/**
 * Every band is one of the engine's own substitution thresholds rather than an invented scale, so
 * the label explains the subs the GM is watching instead of just decorating them: "gassed" is a
 * player the rotation will pull immediately, "tiring" one it's now allowed to pull, and "fresh" one
 * rested enough to be subbed back in (engine/rotation/substitution.ts). The band between the last
 * two is most of a starter's night -- calling that "fresh" would have a half-drained bar sitting
 * next to a label claiming otherwise.
 */
function fatigueLabel(fatigue: number): { text: string; className: string } {
  if (fatigue >= FATIGUE_EMERGENCY_THRESHOLD) return { text: 'gassed', className: 'text-negative' }
  if (fatigue >= FATIGUE_SUB_OUT_THRESHOLD) return { text: 'tiring', className: 'text-negative' }
  if (fatigue > FATIGUE_SUB_IN_MAX) return { text: 'working', className: '' }
  return { text: 'fresh', className: '' }
}

export function OnCourtPanel({
  label,
  onCourt,
  playerById,
  fatigue,
}: {
  label: string
  onCourt: OnCourtRecord[]
  playerById: Map<PlayerId, Player>
  fatigue: Map<PlayerId, number>
}) {
  return (
    <div className="on-court">
      <h3>{label}</h3>
      {onCourt.length === 0 ? (
        <p className="commentary-empty">Tip-off pending.</p>
      ) : (
        <ul className="on-court-list">
          {sortBySlotOrder(onCourt).map(({ playerId: id, slot }) => {
            const player = playerById.get(id)
            const value = Math.round(fatigue.get(id) ?? 0)
            const { text, className } = fatigueLabel(value)

            return (
              <li key={id}>
                {/* The slot, not the player's own position -- so an out-of-position assignment reads
                    as what the GM actually did rather than looking like a mislabel. */}
                <span className="on-court-slot">{slot}</span>
                <span className="on-court-name">{player?.name ?? id}</span>
                <span className="fatigue-bar" role="img" aria-label={`Fatigue ${value} of 100 -- ${text}`}>
                  {/* Filled portion is energy left, not fatigue accrued -- a draining bar reads as
                      "running out" faster than a filling one does. */}
                  <span className="fatigue-bar-fill" style={{ width: `${100 - value}%` }} />
                </span>
                <span className={`on-court-state ${className}`}>{text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
