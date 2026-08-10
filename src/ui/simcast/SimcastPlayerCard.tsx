import { useEffect, useRef } from 'react'
import type { Player } from '../../data/types'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'
import { formatHeight } from '../playerDisplay'
import { attributeExtremes, playerTags, scoutingTags } from '../playerTags'
import type { LiveBoxScoreLine } from './playbackState'

/**
 * One player, read without leaving the broadcast.
 *
 * **An overlay rather than a route, and that is not a style choice.** A live game's generator, its
 * pending directive and its period cursor all live in refs owned by the simcast screen
 * (useSimcastPlayback.ts), so unmounting it destroys the game in progress -- which is why App.tsx
 * returns the simcast above every other screen and why the run's normal player page is unreachable
 * from here. This renders over the top instead, leaving the screen beneath mounted and the game
 * intact.
 *
 * **It shows what the player page cannot.** PlayerScreen's season line is aggregated from committed
 * games, and tonight's is not committed until the final buzzer -- so a GM watching a player have a
 * night has no way to see it there. Fatigue is the same: it exists only in playback state and is
 * gone once the game is saved. Those two are the reason this is its own component rather than the
 * player page in a box.
 *
 * Visibility follows m3-tactical-axis.md's D3, exactly as PlayerScreen does: the attribute sheet and
 * the overall rating are for players the GM employs, and an opponent gets his qualitative tags and
 * what he has actually done on the floor tonight.
 */
export function SimcastPlayerCard({
  player,
  isUserTeam,
  teamLabel,
  line,
  fatigue,
  onClose,
}: {
  player: Player
  isUserTeam: boolean
  teamLabel: string
  /** Tonight's line so far. Undefined for a player who has not been on the floor yet. */
  line: LiveBoxScoreLine | undefined
  fatigue: number
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const tags = isUserTeam ? playerTags(player) : scoutingTags(player)
  const { best, worst } = attributeExtremes(player)

  // Focus moves to the card so the keyboard lands somewhere useful, and Escape closes it -- the
  // broadcast is paused underneath and a GM should be able to get back to it without reaching for
  // the mouse.
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="simcast-card-backdrop" onClick={onClose}>
      {/* Clicks inside the card must not reach the backdrop's close handler. */}
      <div
        className="simcast-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} -- player card`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="simcast-card-head">
          <h3>
            <span className="player-pos">{player.positions[0]}</span> {player.name}
          </h3>
          <button ref={closeRef} className="link-button" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="simcast-card-sub">
          {player.age}y · {formatHeight(player.heightInches)} · #{player.jerseyNumber}
          {/* Own roster only -- see the D3 note above. */}
          {isUserTeam && ` · Overall ${player.overallRating}`} · {teamLabel}
        </p>

        <div className="simcast-card-live">
          <span>
            <strong>Tonight:</strong>{' '}
            {line ? (
              `${line.points} pts · ${line.fieldGoalsMade}-${line.fieldGoalsAttempted} FG · ${line.rebounds} reb · ${line.assists} ast · ${Math.round(line.minutesPlayed)} min`
            ) : (
              <span className="text-muted">hasn't been on the floor yet</span>
            )}
          </span>
          <span>
            <strong>Fatigue:</strong> {Math.round(fatigue)} / 100
          </span>
        </div>

        {tags.length > 0 && (
          <div className="tag-row">
            {tags.map((tag) => (
              <span key={tag.label} className={`tag tag-${tag.tone}`} title={tag.detail}>
                {tag.label}
              </span>
            ))}
          </div>
        )}

        {isUserTeam ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {ATTRIBUTE_COLUMNS.map((col) => (
                    <th key={col.key} className="numeric" title={col.long}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {ATTRIBUTE_COLUMNS.map((col) => (
                    <td key={col.key} className="numeric">
                      {Math.round(player.attributes[col.key])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="simcast-card-scout">
            {/* No ratings for a rival, but the shape of him is fair game -- it is what you would learn
                watching him play, which is the line scoutingTags draws for the tags above. */}
            Best at <strong>{best.long}</strong>, weakest at <strong>{worst.long}</strong>. Their attribute sheet stays with them.
          </p>
        )}
      </div>
    </div>
  )
}
