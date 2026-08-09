import type { AttributeKey, Player, PlayerHiddenTraits } from '../data/types'
import { ATTRIBUTE_CEILING, ATTRIBUTE_FLOOR } from './constants'
import { average, clamp } from './math'

/** The subset of PlayerHiddenTraits that are numeric (and so shiftable) -- excludes `tendency`,
 *  which is categorical. */
export type NumericHiddenTrait = Exclude<keyof PlayerHiddenTraits, 'tendency'>

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

/** Applies a +/- shift to a single, GM-chosen attribute (clamped to the generation floor/ceiling)
 *  and recomputes overallRating -- shop camps (Section 8.5) target one attribute the GM picks,
 *  unlike shiftPlayerAttributes' uniform bump across all of them. */
export function shiftPlayerAttribute(player: Player, attribute: AttributeKey, shift: number): Player {
  const attributes = { ...player.attributes, [attribute]: clamp(player.attributes[attribute] + shift, ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING) }
  return { ...player, attributes, overallRating: Math.round(average(Object.values(attributes))) }
}

/** Applies a different +/- shift to each of several named attributes at once (each clamped to the
 *  generation floor/ceiling), recomputing overallRating once at the end rather than once per
 *  attribute. Roster quirks that describe a *skill shape* rather than a flat bump (Section 3) trade
 *  one group of attributes against another -- "shooters who can't finish" is +outsideShot and
 *  -insideShot in the same breath, and applying those as two separate shifts would recompute the
 *  rating against a half-applied profile. */
export function shiftPlayerAttributesBy(player: Player, shifts: Partial<Record<AttributeKey, number>>): Player {
  const attributes = { ...player.attributes }
  for (const [key, shift] of Object.entries(shifts) as [AttributeKey, number][]) {
    attributes[key] = clamp(attributes[key] + shift, ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING)
  }
  return { ...player, attributes, overallRating: Math.round(average(Object.values(attributes))) }
}

/** Applies a +/- shift to a single numeric hidden trait (clamped to the same generation floor/
 *  ceiling every other rating uses) -- the hidden-trait counterpart to shiftPlayerAttribute, for
 *  coaching upgrades (Section 8.6) that nudge Clutch/Consistency/Durability instead of a visible
 *  attribute. Doesn't touch overallRating -- hidden traits never factor into it. */
export function shiftPlayerHiddenTrait(player: Player, trait: NumericHiddenTrait, shift: number): Player {
  const value = clamp(player.hidden[trait] + shift, ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING)
  return { ...player, hidden: { ...player.hidden, [trait]: value } }
}
