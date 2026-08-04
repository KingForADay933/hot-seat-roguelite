import type { AttributeKey, Player, TeamId } from '../../data/types'
import { ATTRIBUTE_CEILING, ATTRIBUTE_FLOOR } from '../../engine/constants'
import { average, clamp } from '../../engine/math'
import type { Rng } from '../../engine/rng'

export type WildcardEventId = 'breakout' | 'slump'

export interface WildcardEvent {
  id: WildcardEventId
  label: string
}

export const WILDCARD_EVENTS: Record<WildcardEventId, WildcardEvent> = {
  breakout: { id: 'breakout', label: 'Breakout Season' },
  slump: { id: 'slump', label: 'Sophomore Slump' },
}

export interface WildcardEventOutcome {
  eventId: WildcardEventId
  playerId: string
  playerName: string
}

/** Chance a wildcard event fires at all, each season -- "occasional, log-worthy moments," not a
 *  guaranteed beat every season (Section 3). */
const WILDCARD_EVENT_CHANCE = 0.3
const BREAKOUT_MAX_AGE = 23
const BREAKOUT_SHIFT = 8
const SLUMP_SHIFT = -6

function shiftPlayer(player: Player, shift: number): Player {
  const attributes = { ...player.attributes }
  for (const key of Object.keys(attributes) as AttributeKey[]) {
    attributes[key] = clamp(attributes[key] + shift, ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING)
  }
  return { ...player, attributes, overallRating: Math.round(average(Object.values(attributes))) }
}

/**
 * Rolls whether a wildcard event fires this season for the given team, and if so applies it
 * immediately (an in-season jolt, not a development-system change). Breakout targets a young
 * player at random (doc's "a random young player breaks out" example); slump has no age
 * restriction -- anyone can have an off year. Returns the event (or null) plus the resulting
 * players array either way, so callers don't need a separate apply step.
 */
export function rollWildcardEvent(players: Player[], teamId: TeamId, rng: Rng): { players: Player[]; outcome: WildcardEventOutcome | null } {
  if (rng() >= WILDCARD_EVENT_CHANCE) return { players, outcome: null }

  const roster = players.filter((p) => p.teamId === teamId)
  const isBreakout = rng() < 0.5
  const pool = isBreakout ? roster.filter((p) => p.age <= BREAKOUT_MAX_AGE) : roster
  if (pool.length === 0) return { players, outcome: null }

  const target = pool[Math.floor(rng() * pool.length)]
  const eventId: WildcardEventId = isBreakout ? 'breakout' : 'slump'
  const shifted = shiftPlayer(target, isBreakout ? BREAKOUT_SHIFT : SLUMP_SHIFT)

  return {
    players: players.map((p) => (p.id === target.id ? shifted : p)),
    outcome: { eventId, playerId: target.id, playerName: target.name },
  }
}
