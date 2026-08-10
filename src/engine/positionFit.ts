import type { AttributeKey, Player, PlayerAttributes, Position } from '../data/types'
import {
  POSITION_BIAS,
  POSITION_FIT_HEIGHT_PENALTY_PER_INCH,
  POSITION_FIT_SLIDE_PENALTY_PER_SLOT,
  POSITION_HEIGHT_RANGE_INCHES,
  POSITIONLESS_ATTRIBUTE_SPREAD_MAX,
  POSITIONLESS_MIN_HEIGHT_BANDS,
  POSITIONLESS_SEVERITY_MULTIPLIER,
  SLOT_INTERIOR_LEAN,
  SPECIALIST_ATTRIBUTE_SPREAD_MIN,
  SPECIALIST_SEVERITY_MULTIPLIER,
} from './constants'
import { clamp } from './math'
import { POSITION_ORDER } from './matchup'

/**
 * Out-of-position penalty and its derived Positionless/Specialist quirks (rotation-charts.md
 * Section 4, Decision 2). Live whenever a GM's rotation chart puts someone in a slot that isn't
 * their own position; `effectivePlayer` stays a no-op for everyone else, which is every player on
 * an AI team and every player on an un-charted user team (matchup.ts's slotByPosition assigns each
 * of them the slot their positions[0] already names).
 */

/** Attributes an interior slot (C, and to a lesser extent PF) leans on. */
const INTERIOR_ATTRIBUTES: AttributeKey[] = ['insideShot', 'rebounding', 'interiorDefense', 'vertical']

/** Attributes a perimeter slot (PG, and to a lesser extent SG) leans on. */
const PERIMETER_ATTRIBUTES: AttributeKey[] = ['outsideShot', 'passing', 'ballHandling', 'perimeterDefense', 'speed', 'lateralQuickness']

/** How many slots apart two positions sit in PG-SG-SF-PF-C order -- 0 if the same, 4 for PG<->C. */
export function slotSlideDistance(nativePosition: Position, slot: Position): number {
  return Math.abs(POSITION_ORDER.indexOf(slot) - POSITION_ORDER.indexOf(nativePosition))
}

/** Inches a height sits outside a slot's own band -- 0 if it's inside the band already. */
export function heightMisfitInches(heightInches: number, slot: Position): number {
  const [min, max] = POSITION_HEIGHT_RANGE_INCHES[slot]
  if (heightInches < min) return min - heightInches
  if (heightInches > max) return heightInches - max
  return 0
}

/** Every position whose own height band contains this height -- there's real overlap at the edges
 *  (a 6'9" player is in-range for both SF and PF), which is exactly what Positionless reads off. */
export function heightBandsContaining(heightInches: number): Position[] {
  return POSITION_ORDER.filter((position) => {
    const [min, max] = POSITION_HEIGHT_RANGE_INCHES[position]
    return heightInches >= min && heightInches <= max
  })
}

/** Max attribute minus min attribute -- how spiked or flat a profile is. */
export function attributeSpread(player: Player): number {
  const values = Object.values(player.attributes)
  return Math.max(...values) - Math.min(...values)
}

/**
 * Spread measured against what the player's own position is *rolled* with -- how spiked he is beyond
 * what being a point guard already implies.
 *
 * The raw spread can't answer that. POSITION_BIAS builds spread in by construction: a PG is generated
 * at +15 ballHandling and -15 rebounding, a 30-point gap before a single die is thrown, so a raw
 * max-minus-min test on a PG is largely asking "is this point guard shaped like a point guard" --
 * which is why 76% of them read as Specialist and why SF, the one position with an empty bias entry,
 * was the only one coming out mostly neutral. Subtracting the bias first leaves only the dice.
 */
export function positionRelativeSpread(player: Player): number {
  const bias = POSITION_BIAS[player.positions[0]]
  const residuals = (Object.keys(player.attributes) as AttributeKey[]).map(
    (key) => player.attributes[key] - (bias[key] ?? 0),
  )
  return Math.max(...residuals) - Math.min(...residuals)
}

/**
 * Height sits in more than one position's band and the attribute profile is roughly flat -- a
 * player who is genuinely comfortable sliding rather than miscast. Derived fresh every time, never
 * stored (Section 4's "derive, don't store").
 */
export function isPositionless(player: Player): boolean {
  return (
    heightBandsContaining(player.heightInches).length >= POSITIONLESS_MIN_HEIGHT_BANDS &&
    positionRelativeSpread(player) <= POSITIONLESS_ATTRIBUTE_SPREAD_MAX
  )
}

/**
 * The attribute profile is sharply spiked *for the position* -- built for exactly one slot. Checked
 * after Positionless (which a spiked-but-multi-band player would otherwise also match) so the two
 * quirks are mutually exclusive.
 *
 * This used to have a second arm: a height within SPECIALIST_HEIGHT_EDGE_INCHES of either edge of
 * the player's own band. It was removed rather than retuned, for two reasons. It double-counted --
 * `effectivePlayer` already charges an extreme height per inch, continuously, through
 * `heightMisfitInches`, and in the right direction (the shortest PG is the one who misfits every
 * slot he slides to). And multiplying by 1.5 for height also scales the *slide-distance* term, which
 * has nothing to do with how tall the player is. It could not be made rare either: the bands are
 * five to seven discrete inches wide, so ~25% of every position lands exactly on an edge, and the
 * arm handed out a 1.5x cliff for a one-inch difference. Height inflexibility is still priced; it is
 * just priced once, smoothly, where it belongs.
 */
export function isSpecialist(player: Player): boolean {
  if (isPositionless(player)) return false
  return positionRelativeSpread(player) >= SPECIALIST_ATTRIBUTE_SPREAD_MIN
}

/** Positionless takes less of a hit sliding slots, Specialist takes more; everyone else is neutral. */
export function positionFitSeverityMultiplier(player: Player): number {
  if (isPositionless(player)) return POSITIONLESS_SEVERITY_MULTIPLIER
  if (isSpecialist(player)) return SPECIALIST_SEVERITY_MULTIPLIER
  return 1
}

/** 0 (this slot doesn't lean on the attribute at all) to 1 (leans on it fully) -- see
 *  SLOT_INTERIOR_LEAN's doc comment for how the interior/perimeter split maps to each slot. */
function demandWeight(attribute: AttributeKey, slot: Position): number {
  const lean = SLOT_INTERIOR_LEAN[slot]
  if (INTERIOR_ATTRIBUTES.includes(attribute)) return lean
  if (PERIMETER_ATTRIBUTES.includes(attribute)) return 1 - lean
  return 0
}

/**
 * The transient effective-attribute shift a slot assignment applies to a player (rotation-charts.md
 * Section 4). Returns the same Player reference, unchanged, when the slot matches the player's own
 * position -- which is every slot in the game today, and keeps this a true no-op until a rotation
 * chart can actually place someone out of position.
 *
 * Never persisted (the caller must not write the result back to a roster or save) and never touches
 * overallRating (display-only, and the sim is barred from reading it anyway).
 */
export function effectivePlayer(player: Player, slot: Position): Player {
  const nativePosition = player.positions[0]
  if (slot === nativePosition) return player

  const severity =
    (POSITION_FIT_SLIDE_PENALTY_PER_SLOT * slotSlideDistance(nativePosition, slot) +
      POSITION_FIT_HEIGHT_PENALTY_PER_INCH * heightMisfitInches(player.heightInches, slot)) *
    positionFitSeverityMultiplier(player)

  const attributes = { ...player.attributes }
  ;(Object.keys(attributes) as AttributeKey[]).forEach((key) => {
    const dock = severity * demandWeight(key, slot)
    if (dock > 0) attributes[key] = clamp(attributes[key] - dock, 0, 100)
  })

  return { ...player, attributes: attributes as PlayerAttributes }
}

