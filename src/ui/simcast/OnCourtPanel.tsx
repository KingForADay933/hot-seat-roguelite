import type { OnCourtRecord, Player, PlayerId } from '../../data/types'
import { FATIGUE_EMERGENCY_THRESHOLD, FATIGUE_SUB_IN_MAX, FATIGUE_SUB_OUT_THRESHOLD } from '../../engine/constants'
import { POSITION_ORDER } from '../../engine/matchup'
import { PlayerName } from '../components/PlayerName'
import { attributeExtremes } from '../playerTags'

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

/**
 * The one-line "who is this" read under a name on the floor.
 *
 * Split on whose player it is, because m3-tactical-axis.md's D3 governs this panel too: it shows
 * *both* fives, and overall rating is the single number that ranks a roster at a glance -- exactly
 * the homework D3 keeps off an opponent's players (see PlayerScreen, which gates it the same way).
 * So the GM's own five gets the overall and the best attribute with its rating, and the opposing
 * five gets the best attribute's *name* with no number attached.
 *
 * That is the same line scoutingTags already draws: a rival's strengths are describable, his ratings
 * are not. "Their centre is an inside scorer" is what you learn from watching him; "Inside Shot 91"
 * is a spreadsheet.
 */
function glanceLine(player: Player, isUserTeam: boolean): string {
  const { best } = attributeExtremes(player)
  if (!isUserTeam) return best.label
  return `${player.overallRating} OVR · ${best.label} ${Math.round(best.value)}`
}

export function OnCourtPanel({
  label,
  onCourt,
  playerById,
  fatigue,
  isUserTeam,
}: {
  label: string
  onCourt: OnCourtRecord[]
  playerById: Map<PlayerId, Player>
  fatigue: Map<PlayerId, number>
  /** Whether this is the GM's own five, which decides how much of each player is quoted. */
  isUserTeam: boolean
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
                <span className="on-court-name">
                  {/* Clickable through to the card overlay. PlayerName falls back to plain text on
                      its own if no inspector is in scope, so this panel stays valid in isolation. */}
                  <PlayerName playerId={id} name={player?.name ?? id} />
                  {player && <span className="on-court-glance">{glanceLine(player, isUserTeam)}</span>}
                </span>
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
