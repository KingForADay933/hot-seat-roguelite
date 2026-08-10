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
  openTeam: (teamId: TeamId) => void
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
