import type { Team } from '../../data/types'
import { useInspector } from '../state/inspector.core'
import { TeamSwatch } from './TeamSwatch'

/**
 * A team's name with its colour swatch, clickable through to its scouting report wherever one can
 * be opened. The sibling of PlayerName, with the same fallback-to-plain-text behaviour and the same
 * reason for being a `button` rather than a styled span.
 *
 * Takes a `label` separately from the team because the two call sites want different lengths of the
 * same name -- the standings has room for "Millbrook Ospreys", a schedule row has room for "MIL" --
 * and neither should have to reach past this component to render the swatch itself.
 */
export function TeamName({
  team,
  label,
  fallback,
  bold,
}: {
  /** Undefined when the caller only has an id (a game referencing a team not in the bundle). */
  team?: Team
  label?: string
  /** Rendered when there's no team to name -- the raw id, usually. */
  fallback: string
  bold?: boolean
}) {
  const inspector = useInspector()
  const text = team ? (label ?? `${team.city} ${team.name}`) : fallback

  const inner = (
    <>
      {team && <TeamSwatch team={team} />}
      {text}
    </>
  )

  if (!team || !inspector) {
    return (
      <span className="team-name" style={bold ? { fontWeight: 700 } : undefined}>
        {inner}
      </span>
    )
  }

  return (
    <button
      type="button"
      className="team-name player-link"
      style={bold ? { fontWeight: 700 } : undefined}
      onClick={() => inspector.openTeam(team.id)}
      title={`Scouting report: ${team.city} ${team.name}`}
    >
      {inner}
    </button>
  )
}
