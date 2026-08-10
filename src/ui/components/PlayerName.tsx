import type { PlayerId } from '../../data/types'
import { useInspector } from '../state/inspector.core'

/**
 * A player's name, clickable through to their detail page wherever one can be opened.
 *
 * Falls back to plain text when there's no inspector in scope, so a name is never a dead control:
 * a table rendered outside the provider shows the name and nothing else rather than a button that
 * does nothing when clicked.
 *
 * A `button` rather than a styled span so it's keyboard-reachable and announced as an action --
 * these sit inside dense tables where a subtle text colour alone wouldn't say "this does something".
 */
export function PlayerName({
  playerId,
  name,
  prefix,
}: {
  playerId: PlayerId
  name: string
  /** Optional leading text kept inside the control, e.g. a position. Part of the click target
   *  because "PG Devon Whitlock" reads as one label. */
  prefix?: string
}) {
  const inspector = useInspector()
  const label = prefix ? `${prefix} ${name}` : name

  if (!inspector) return <>{label}</>

  return (
    <button type="button" className="player-link" onClick={() => inspector.openPlayer(playerId)} title={`Scouting report: ${name}`}>
      {label}
    </button>
  )
}
