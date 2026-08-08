import type { Player, PlayerId, Position } from '../data/types'
import { average } from './math'

export const POSITION_ORDER: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

export function sortByPosition(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) => POSITION_ORDER.indexOf(a.positions[0]) - POSITION_ORDER.indexOf(b.positions[0]),
  )
}

/**
 * A player and the slot they are filling right now.
 *
 * The slot -- not `Player.positions` -- is what the simulation pairs matchups on and evaluates a
 * player as. Today every slot is filled by someone whose first listed position matches it, so the
 * two are always the same; separating them is what will let a GM put a player somewhere they don't
 * belong and have the engine understand what that means.
 */
export interface OnCourtPlayer {
  player: Player
  slot: Position
}

/**
 * Slot-assigns a five from each player's own first listed position.
 *
 * The assignment every five uses today, and the standing fallback for any team without a rotation
 * chart -- which will always include the seven AI teams.
 */
export function slotByPosition(players: Player[]): OnCourtPlayer[] {
  return players.map((player) => ({ player, slot: player.positions[0] }))
}

/** A five in slot order, PG through C. */
export function sortBySlot(five: OnCourtPlayer[]): OnCourtPlayer[] {
  return [...five].sort((a, b) => POSITION_ORDER.indexOf(a.slot) - POSITION_ORDER.indexOf(b.slot))
}

/**
 * Fixed slot-to-slot matchups: whoever is filling PG guards whoever is filling PG.
 *
 * Pairs on the slot rather than on each player's listed position, so an out-of-position assignment
 * produces the matchup the GM actually asked for instead of silently re-sorting itself back into
 * position order.
 */
export function buildMatchups(offense: OnCourtPlayer[], defense: OnCourtPlayer[]): Map<PlayerId, Player> {
  const sortedOffense = sortBySlot(offense)
  const sortedDefense = sortBySlot(defense)
  const map = new Map<PlayerId, Player>()
  sortedOffense.forEach((entry, i) => map.set(entry.player.id, sortedDefense[i]?.player))
  return map
}

/** Whoever is filling a given slot within a five, if anyone. */
export function findAtSlot(slot: Position, five: OnCourtPlayer[]): Player | undefined {
  return five.find((entry) => entry.slot === slot)?.player
}

/** The plain players behind a five, for the team-average terms in strength/resistance that don't
 *  care who is filling which slot. */
export function playersOf(five: OnCourtPlayer[]): Player[] {
  return five.map((entry) => entry.player)
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
