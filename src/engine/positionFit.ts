import type { AttributeKey, Player, PlayerAttributes, Position } from '../data/types'
import {
  POSITION_FIT_HEIGHT_PENALTY_PER_INCH,
  POSITION_FIT_SLIDE_PENALTY_PER_SLOT,
  POSITION_HEIGHT_RANGE_INCHES,
  POSITIONLESS_ATTRIBUTE_SPREAD_MAX,
  POSITIONLESS_MIN_HEIGHT_BANDS,
  POSITIONLESS_SEVERITY_MULTIPLIER,
  SLOT_INTERIOR_LEAN,
  SPECIALIST_ATTRIBUTE_SPREAD_MIN,
  SPECIALIST_HEIGHT_EDGE_INCHES,
  SPECIALIST_SEVERITY_MULTIPLIER,
} from './constants'
import { clamp } from './math'
import { POSITION_ORDER, type OnCourtPlayer } from './matchup'

/**
 * Out-of-position penalty and its derived Positionless/Specialist quirks (rotation-charts.md
 * Section 4, Decision 2). Nothing here is reachable yet through real gameplay -- every on-court five
 * is still slot-assigned from each player's own positions[0] (matchup.ts's slotByPosition), so
 * `effectivePlayer` is a no-op today. It exists so the mechanism is in place, tested, and wired into
 * the simulation before Phase F/G give a GM any way to actually chart a mismatch.
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
 * Height sits in more than one position's band and the attribute profile is roughly flat -- a
 * player who is genuinely comfortable sliding rather than miscast. Derived fresh every time, never
 * stored (Section 4's "derive, don't store").
 */
export function isPositionless(player: Player): boolean {
  return (
    heightBandsContaining(player.heightInches).length >= POSITIONLESS_MIN_HEIGHT_BANDS &&
    attributeSpread(player) <= POSITIONLESS_ATTRIBUTE_SPREAD_MAX
  )
}

/**
 * Height sits at the extreme edge of a single band, or the attribute profile is sharply spiked --
 * built for exactly one slot. Checked after Positionless (which a spiked-but-multi-band player would
 * otherwise also match) so the two quirks are mutually exclusive.
 */
export function isSpecialist(player: Player): boolean {
  if (isPositionless(player)) return false
  const [nativeMin, nativeMax] = POSITION_HEIGHT_RANGE_INCHES[player.positions[0]]
  const atEdge =
    player.heightInches - nativeMin <= SPECIALIST_HEIGHT_EDGE_INCHES ||
    nativeMax - player.heightInches <= SPECIALIST_HEIGHT_EDGE_INCHES
  return atEdge || attributeSpread(player) >= SPECIALIST_ATTRIBUTE_SPREAD_MIN
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

/**
 * Applies effectivePlayer across a whole on-court five, for the one call site (simulateGame.ts's
 * per-possession offense/defense fives) that needs the shift to reach every reader -- selection,
 * offense strength, resistance, rebounding -- for free, by handing them an already-adjusted Player
 * rather than threading a penalty through each of those signatures.
 */
export function effectiveFive(five: OnCourtPlayer[]): OnCourtPlayer[] {
  return five.map((entry) => ({ slot: entry.slot, player: effectivePlayer(entry.player, entry.slot) }))
}
