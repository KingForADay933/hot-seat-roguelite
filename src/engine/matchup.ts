import type { Player, PlayerId, Position } from '../data/types'
import { average } from './math'

export const POSITION_ORDER: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

export function sortByPosition(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) => POSITION_ORDER.indexOf(a.positions[0]) - POSITION_ORDER.indexOf(b.positions[0]),
  )
}

/** Fixed position-to-position matchups (PG guards PG, etc.), matched by each player's first listed position. */
export function buildMatchups(offense: Player[], defense: Player[]): Map<PlayerId, Player> {
  const sortedOffense = sortByPosition(offense)
  const sortedDefense = sortByPosition(defense)
  const map = new Map<PlayerId, Player>()
  sortedOffense.forEach((player, i) => map.set(player.id, sortedDefense[i]))
  return map
}

/** The player occupying a given position (by first listed position) within a five, if any. */
export function findAtPosition(position: Position, players: Player[]): Player | undefined {
  return players.find((p) => p.positions[0] === position)
}

export const avgPerimeterDefense = (p: Player) => (p.attributes.lateralQuickness + p.attributes.perimeterDefense) / 2
export const avgInteriorDefense = (p: Player) => (p.attributes.interiorDefense + p.attributes.vertical) / 2

/**
 * Raw-attribute equivalent of overallRating, recomputed fresh -- simulation code must never read
 * Player.overallRating (UI/scouting flavor only), so this is the legal way to get an "overall
 * quality" signal into sim/rotation logic. Deliberately duplicates overallRating's averaging
 * formula rather than reading the cached field.
 */
export function rawOverallQuality(p: Player): number {
  return average(Object.values(p.attributes))
}

/** Used for structural/deterministic picks (defender assignment, substitute selection) --
 *  not usage, which is randomized elsewhere. Ties resolve to whichever player appears first. */
export function pickBest(players: Player[], score: (p: Player) => number): Player {
  let best = players[0]
  let bestScore = score(best)
  for (let i = 1; i < players.length; i++) {
    const s = score(players[i])
    if (s > bestScore) {
      best = players[i]
      bestScore = s
    }
  }
  return best
}
