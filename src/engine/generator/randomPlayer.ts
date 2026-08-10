import { createId } from '../../data/ids'
import type { AttributeKey, Player, PlayerAttributes, Position, TendencyProfile } from '../../data/types'
import {
  ATTRIBUTE_BASELINE_SPAN,
  ATTRIBUTE_CEILING,
  ATTRIBUTE_FLOOR,
  ATTRIBUTE_STANDOUT_CHANCE,
  ATTRIBUTE_STANDOUT_MIN,
  ATTRIBUTE_STANDOUT_SPAN,
  POSITION_BIAS,
  POSITION_HEIGHT_RANGE_INCHES,
} from '../constants'
import { average, clamp } from '../math'
import type { Rng } from '../rng'
import { computeAgeCurveStage } from './ageCurve'

/**
 * Name pools, deliberately larger than the roster they have to fill.
 *
 * At 20x20 a full league drew 96 players from 400 combinations, and the birthday maths makes that
 * roughly eleven expected collisions -- which is exactly what turned up in play: one roster carried
 * two different players called Xavier Ellery, and four Codys. 40x40 is 1600 combinations for the
 * same 96 draws, so `pickUniqueName` below now rarely has to reject anything, and first names stop
 * repeating four times in a twelve-man roster.
 */
const FIRST_NAMES = [
  'Marcus', 'Devon', 'Jalen', 'Isaiah', 'Xavier', 'Tremaine', 'Cody', 'Anthony', 'Miles', 'Julian',
  'Elijah', 'Trevon', 'Damian', 'Cameron', 'Rashad', 'Kobe', 'Andre', 'Malik', 'Terrence', 'Gabriel',
  'Tyrese', 'Quentin', 'Amari', 'Donovan', 'Zion', 'Corey', 'Bryce', 'Keegan', 'Omari', 'Landon',
  'Micah', 'Deshawn', 'Roman', 'Silas', 'Emmanuel', 'Kai', 'Nico', 'Trey', 'Vaughn', 'Josiah',
]
const LAST_NAMES = [
  'Whitfield', 'Okafor', 'Bramwell', 'Sinclair', 'Delgado', 'Fenwick', 'Harlow', 'Castellan', 'Ambrose', 'Rourke',
  'Kessler', 'Marsh', 'Voss', 'Tanaka', 'Ellery', 'Baptiste', 'Nakamura', 'Whitlock', 'Solano', 'Ferris',
  'Adeyemi', 'Brennan', 'Calloway', 'Duval', 'Eastwood', 'Grieves', 'Halvorsen', 'Ivers', 'Jennings', 'Kowalski',
  'Lindqvist', 'Moreau', 'Novak', 'Prieto', 'Quintero', 'Ridley', 'Stavros', 'Thorne', 'Ulrich', 'Vandermeer',
]

/** Rolls before giving up on chance and walking the name space in order. Small because at the pool
 *  sizes above a collision is already unlikely; the walk exists for correctness, not for speed. */
const NAME_ROLL_ATTEMPTS = 12

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
}

/**
 * A name nobody in `taken` already has.
 *
 * Rolls first, because a random draw is what gives the league its texture, and only falls back to
 * a deterministic walk of the whole space once the rolls keep colliding -- which bounds the work
 * instead of looping on chance. If every combination is genuinely spoken for (more players than
 * FIRST_NAMES x LAST_NAMES, which no league this size can reach) it returns a duplicate rather than
 * failing: a repeated name is a cosmetic annoyance, and refusing to generate a player is not.
 *
 * `taken` is mutated so a caller can thread one set through a whole league and get league-wide
 * uniqueness, rather than uniqueness that stops at each roster's edge.
 */
function pickUniqueName(rng: Rng, taken?: Set<string>): string {
  if (!taken) return `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`

  for (let attempt = 0; attempt < NAME_ROLL_ATTEMPTS; attempt++) {
    const name = `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`
    if (!taken.has(name)) {
      taken.add(name)
      return name
    }
  }

  for (const last of LAST_NAMES) {
    for (const first of FIRST_NAMES) {
      const name = `${first} ${last}`
      if (!taken.has(name)) {
        taken.add(name)
        return name
      }
    }
  }

  return `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`
}

function rollRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

/**
 * Sum of 3 uniform rolls approximates a bell curve, centered so the baseline roll averages ~70
 * (2K-style "decent NBA level") before position bias; occasional standout roll pushes into the
 * elite 90s regardless of bias -- a talent ceiling that doesn't care where a player's weaknesses are.
 */
function rollAttribute(rng: Rng, bias: number): number {
  const bell = (rng() + rng() + rng()) / 3
  let value = ATTRIBUTE_FLOOR + bell * ATTRIBUTE_BASELINE_SPAN + bias
  if (rng() < ATTRIBUTE_STANDOUT_CHANCE) {
    value = ATTRIBUTE_STANDOUT_MIN + rng() * ATTRIBUTE_STANDOUT_SPAN
  }
  return clamp(Math.round(value), ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING)
}

function pickTendency(position: Position, rng: Rng): TendencyProfile {
  const roll = rng()
  if (position === 'C' || position === 'PF') {
    return roll < 0.5 ? 'balanced' : roll < 0.85 ? 'pass-first' : 'shoot-first'
  }
  return roll < 0.33 ? 'pass-first' : roll < 0.66 ? 'balanced' : 'shoot-first'
}

/**
 * `shift` is a league-wide additive offset composed with each attribute's position bias -- a
 * parity/difficulty knob (League Setup's "Average Overall" slider). The 5% standout-roll branch
 * inside rollAttribute deliberately ignores both bias and shift: a talent ceiling shouldn't move
 * just because the league's average did.
 */
/** `takenNames`, when passed, is read *and added to* -- thread one set through every team in a
 *  league and no two players anywhere in it share a name. Omit it and names are drawn freely, which
 *  is what a one-off player (a test, a fixture) wants. */
export function generatePlayer(position: Position, rng: Rng, shift: number = 0, takenNames?: Set<string>): Player {
  const bias = POSITION_BIAS[position]
  const attributes: PlayerAttributes = {
    insideShot: rollAttribute(rng, (bias.insideShot ?? 0) + shift),
    outsideShot: rollAttribute(rng, (bias.outsideShot ?? 0) + shift),
    passing: rollAttribute(rng, (bias.passing ?? 0) + shift),
    ballHandling: rollAttribute(rng, (bias.ballHandling ?? 0) + shift),
    rebounding: rollAttribute(rng, (bias.rebounding ?? 0) + shift),
    perimeterDefense: rollAttribute(rng, (bias.perimeterDefense ?? 0) + shift),
    interiorDefense: rollAttribute(rng, (bias.interiorDefense ?? 0) + shift),
    speed: rollAttribute(rng, (bias.speed ?? 0) + shift),
    lateralQuickness: rollAttribute(rng, (bias.lateralQuickness ?? 0) + shift),
    vertical: rollAttribute(rng, (bias.vertical ?? 0) + shift),
  }

  const age = 19 + Math.floor(rng() * 17) // 19-35
  const ageCurveStage = computeAgeCurveStage(age)
  const overallRating = Math.round(average(Object.values(attributes)))
  // Per-attribute ceiling, rolled off each attribute's own current value (not the averaged
  // overallRating) so a player's growth headroom varies attribute-by-attribute, not uniformly.
  const potential = Object.fromEntries(
    (Object.keys(attributes) as AttributeKey[]).map((key) => [
      key,
      ageCurveStage === 'rising'
        ? clamp(Math.round(attributes[key] + 10 + rollRange(rng, 0, 15)), ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING)
        : clamp(Math.round(attributes[key] + rollRange(rng, -5, 5)), ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING),
    ]),
  ) as Record<AttributeKey, number>

  const [minHeight, maxHeight] = POSITION_HEIGHT_RANGE_INCHES[position]

  return {
    id: createId('player'),
    name: pickUniqueName(rng, takenNames),
    age,
    positions: [position],
    heightInches: Math.round(rollRange(rng, minHeight, maxHeight)),
    jerseyNumber: 1 + Math.floor(rng() * 98),
    teamId: null,
    portraitPlaceholder: position,
    attributes,
    hidden: {
      consistency: Math.round(rollRange(rng, 40, 90)),
      clutch: Math.round(rollRange(rng, 40, 90)),
      durability: Math.round(rollRange(rng, 40, 90)),
      tendency: pickTendency(position, rng),
      morale: 70,
    },
    development: {
      potential,
      developmentPoints: 0,
      ageCurveStage,
    },
    overallRating,
  }
}
