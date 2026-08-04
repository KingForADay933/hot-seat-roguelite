import type { Team } from '../../data/types'

/** Small color chip using the team's generated colors -- gives every team a visual identity
 *  instead of just a name in a table. */
export function TeamSwatch({ team }: { team: Team }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: team.primaryColor,
        border: `2px solid ${team.secondaryColor}`,
        marginRight: 6,
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  )
}
