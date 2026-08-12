import type { ReactNode } from 'react'

/**
 * A screen's primary actions, in a bar that stays put while the rest of the screen scrolls.
 *
 * Every screen but the simcast used to keep its actions in the last few lines of its JSX -- measured
 * across all fourteen, `Continue Season`, `Back`, `Lock In System` and the rest all sat past the
 * bottom of the viewport, so acting on a screen meant scrolling to the end of it first.
 *
 * **One instance, moved rather than copied.** Rendering the same buttons at the top *and* the bottom
 * would put two live copies of every action in the page: two things for a screen reader to announce,
 * two places for a disabled state to be got right, and two handlers to keep in step. Sticking one
 * set is strictly more reachable anyway -- the actions are there at every scroll position, not just
 * at the two ends.
 *
 * Takes the buttons as children rather than a list of labels and callbacks, because several carry
 * state the bar has no business knowing: TeamRevealScreen's Lock In System is disabled until a system
 * is picked, and the shop's Continue changes with what is left to spend.
 */
export function ScreenActions({ children }: { children: ReactNode }) {
  return (
    <div className="screen-actions">
      <div className="screen-actions-inner">{children}</div>
    </div>
  )
}
