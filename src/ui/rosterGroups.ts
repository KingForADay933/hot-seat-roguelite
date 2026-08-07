import type { Player, Team } from '../data/types'
import { POSITION_ORDER } from '../engine/matchup'

/**
 * The starters-vs-bench split every roster-facing surface uses (TeamSummary, the roster
 * adjustment tables, the shop's camp dropdown) -- starters in PG-to-C order first, then whoever
 * is left in roster order. Shared so the three don't drift apart.
 */
export function splitRoster(team: Team, roster: Player[]): { starters: Player[]; bench: Player[] } {
  const starters = team.startingFive
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined)
    .sort((a, b) => POSITION_ORDER.indexOf(a.positions[0]) - POSITION_ORDER.indexOf(b.positions[0]))

  const starterIds = new Set(starters.map((p) => p.id))
  return { starters, bench: roster.filter((p) => !starterIds.has(p.id)) }
}
