import type { Team } from '../../data/types'
import { teamColorStyle } from '../teamColors'

/**
 * A team's colour bar, beside its name wherever one appears.
 *
 * A bar rather than the dot this used to be: at 10px round, two colours read as one muddy speck, and
 * a standings table full of them said nothing. Upright and squared off, the primary and secondary
 * are both legible and the table starts to look like a league of distinct teams.
 */
export function TeamSwatch({ team }: { team: Team }) {
  return <span className="team-swatch" aria-hidden="true" style={teamColorStyle(team)} />
}
