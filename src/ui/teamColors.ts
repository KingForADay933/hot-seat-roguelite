import type { CSSProperties } from 'react'
import type { Team } from '../data/types'

/**
 * A team's colours, published as CSS custom properties for anything underneath to style with.
 *
 * Every team has carried a primary/secondary pair since generation (randomLeague.ts's COLOR_PALETTE),
 * and until now the only thing that read them was a 10px dot. That is the game's identity sitting
 * unspent: eight teams that look identical apart from a name, in a game about one of them being
 * yours.
 *
 * Custom properties rather than inline `backgroundColor` on each element, because the colours need to
 * reach several things at different depths -- a scoreboard side, its score, a standings row's chip,
 * a header bar -- and threading two strings into every one of them would put team branding in the
 * signature of every component that happens to sit inside a team's context.
 */
export function teamColorStyle(team: Pick<Team, 'primaryColor' | 'secondaryColor'>): CSSProperties {
  return {
    '--team-primary': team.primaryColor,
    '--team-secondary': team.secondaryColor,
  } as CSSProperties
}
