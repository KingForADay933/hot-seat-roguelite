import type { PlayerId, Position, RotationPlan } from '../../data/types'

/**
 * Whoever the chart says must be filling this slot right now, or null if the chart has no opinion --
 * no plan at all, no entry for this period or slot, a gap between segments, or an explicit `auto`
 * segment. All four of those are the same thing (Decision 3: "unfilled time is implicitly Auto"), so
 * the caller (substitution.ts's checkSubstitutions) can treat null as one uniform "fall through to
 * the fatigue/pace heuristic" signal rather than distinguishing why the chart is silent.
 *
 * `secondsIntoPeriod` is seconds since the current period's own start (PERIOD_SECONDS - clock in
 * simulateGame.ts's runPeriod), not the whole game -- segments are authored per period and restart
 * at 0 every period, same as the period clock itself.
 */
export function chartedPlayerId(
  plan: RotationPlan | undefined,
  period: number,
  slot: Position,
  secondsIntoPeriod: number,
): PlayerId | null {
  const segments = plan?.[period]?.[slot]
  if (!segments) return null

  const active = segments.find((s) => secondsIntoPeriod >= s.startSeconds && secondsIntoPeriod < s.endSeconds)
  if (!active || active.fill.kind !== 'player') return null
  return active.fill.playerId
}
