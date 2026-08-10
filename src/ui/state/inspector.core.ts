import { createContext, useContext } from 'react'
import type { PlayerId, TeamId } from '../../data/types'

/**
 * Opening a detail page from wherever a player's or a team's name appears.
 *
 * A context rather than a prop, because names are rendered five layers deep in several unrelated
 * places -- the roster sheet, the scouting table, the checkpoint adjustment table, a box score
 * inside the stretch screen, the standings, a schedule row. Threading an `onOpenPlayer` callback
 * through all of those would put navigation plumbing in the signature of every component that
 * happens to render a name.
 *
 * One context covering both destinations rather than two near-identical ones: every provider site
 * offers both, and they behave the same way. Splitting them would be duplication, not separation.
 *
 * Deliberately separate from RunContext, which is run *data*. This is view state, and mixing the
 * two would mean every consumer of a run's roster also re-renders on a navigation change.
 */
export interface Inspector {
  openPlayer: (playerId: PlayerId) => void
  /**
   * Null where a team page cannot be reached from here, and the simcast is the case that matters.
   *
   * A live broadcast holds its game generator in a ref for the life of the screen
   * (simcast/useSimcastPlayback.ts), so routing away to a full screen would unmount it and lose the
   * game in progress. The simcast therefore provides an inspector that opens players in an overlay
   * and offers no team destination at all. Rather than hand it a no-op -- a control that looks live
   * and does nothing -- TeamName degrades to plain text on null, exactly as both names already do
   * when there is no inspector in scope at all.
   */
  openTeam: ((teamId: TeamId) => void) | null
}

export const InspectorContext = createContext<Inspector | null>(null)

/**
 * Null-safe on purpose: a name rendered outside a provider (a test harness, a screen that hasn't
 * been wired yet) stays plain text rather than throwing. Contrast useRun, which throws -- a screen
 * with no run data can't render at all, whereas a name that isn't clickable is merely less useful.
 */
export function useInspector(): Inspector | null {
  return useContext(InspectorContext)
}
