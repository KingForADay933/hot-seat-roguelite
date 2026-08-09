import { createContext, useContext } from 'react'
import type { PlayerId } from '../../data/types'

/**
 * Opening a player's detail page from wherever their name appears.
 *
 * A context rather than a prop, because player names are rendered five layers deep in several
 * unrelated places -- the roster sheet, the scouting table, the checkpoint adjustment table, a box
 * score inside the stretch screen. Threading an `onOpenPlayer` callback through all of those would
 * put navigation plumbing in the signature of every component that happens to render a name.
 *
 * Deliberately separate from RunContext, which is run *data*. This is view state, and mixing the
 * two would mean every consumer of a run's roster also re-renders on a navigation change.
 */
export interface PlayerInspector {
  openPlayer: (playerId: PlayerId) => void
}

export const PlayerInspectorContext = createContext<PlayerInspector | null>(null)

/**
 * Null-safe on purpose: a name rendered outside a provider (a test harness, a screen that hasn't
 * been wired yet) stays plain text rather than throwing. Contrast useRun, which throws -- a screen
 * with no run data can't render at all, whereas a name that isn't clickable is merely less useful.
 */
export function usePlayerInspector(): PlayerInspector | null {
  return useContext(PlayerInspectorContext)
}
