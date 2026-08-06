import type { AttributeKey, Player } from '../data/types'
import { ATTRIBUTE_CEILING, ATTRIBUTE_FLOOR } from './constants'
import { average, clamp } from './math'

/** Applies a uniform +/- shift to every attribute (clamped to the generation floor/ceiling) and
 *  recomputes overallRating -- the shared "bump every attribute by N" primitive behind roster
 *  quirks (Section 3) and wildcard events (Section 3). */
export function shiftPlayerAttributes(player: Player, shift: number): Player {
  const attributes = { ...player.attributes }
  for (const key of Object.keys(attributes) as AttributeKey[]) {
    attributes[key] = clamp(attributes[key] + shift, ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING)
  }
  return { ...player, attributes, overallRating: Math.round(average(Object.values(attributes))) }
}

/** Applies a +/- shift to a single chosen attribute (clamped to the generation floor/ceiling) and
 *  recomputes overallRating -- shop camps (Section 8.5) use this instead of shiftPlayerAttributes
 *  so the GM directs the boost at one attribute rather than bumping the whole profile. */
export function shiftPlayerAttribute(player: Player, attribute: AttributeKey, shift: number): Player {
  const attributes = { ...player.attributes, [attribute]: clamp(player.attributes[attribute] + shift, ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING) }
  return { ...player, attributes, overallRating: Math.round(average(Object.values(attributes))) }
}
