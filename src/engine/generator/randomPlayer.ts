import { createId } from '../../data/ids'
import type { AttributeKey, Player, PlayerAttributes, Position, TendencyProfile } from '../../data/types'
import {
  ATTRIBUTE_BASELINE_SPAN,
  ATTRIBUTE_CEILING,
  ATTRIBUTE_FLOOR,
  ATTRIBUTE_STANDOUT_CHANCE,
  ATTRIBUTE_STANDOUT_MIN,
  ATTRIBUTE_STANDOUT_SPAN,
} from '../constants'
import { average, clamp } from '../math'
import type { Rng } from '../rng'
import { computeAgeCurveStage } from './ageCurve'

/** Position-flavored attribute bias, in points, applied on top of a bell-ish baseline roll. */
const POSITION_BIAS: Record<Position, Partial<Record<keyof PlayerAttributes, number>>> = {
  PG: {
    ballHandling: 15,
    passing: 15,
    speed: 10,
    lateralQuickness: 10,
    outsideShot: 5,
    insideShot: -10,
    interiorDefense: -15,
    rebounding: -15,
  },
  SG: {
    outsideShot: 15,
    ballHandling: 5,
    speed: 5,
    perimeterDefense: 5,
    interiorDefense: -10,
    rebounding: -10,
  },
  SF: {},
  PF: {
    insideShot: 10,
    rebounding: 10,
    interiorDefense: 10,
    vertical: 5,
    outsideShot: -10,
    ballHandling: -10,
    speed: -5,
  },
  C: {
    insideShot: 15,
    rebounding: 15,
    interiorDefense: 15,
    vertical: 10,
    outsideShot: -15,
    ballHandling: -15,
    speed: -10,
    lateralQuickness: -10,
    passing: -5,
  },
}

const HEIGHT_RANGE_INCHES: Record<Position, [number, number]> = {
  PG: [72, 76],
  SG: [74, 78],
  SF: [77, 81],
  PF: [80, 84],
  C: [82, 88],
}

const FIRST_NAMES = [
  'Marcus', 'Devon', 'Jalen', 'Isaiah', 'Xavier', 'Tremaine', 'Cody', 'Anthony', 'Miles', 'Julian',
  'Elijah', 'Trevon', 'Damian', 'Cameron', 'Rashad', 'Kobe', 'Andre', 'Malik', 'Terrence', 'Gabriel',
]
const LAST_NAMES = [
  'Whitfield', 'Okafor', 'Bramwell', 'Sinclair', 'Delgado', 'Fenwick', 'Harlow', 'Castellan', 'Ambrose', 'Rourke',
  'Kessler', 'Marsh', 'Voss', 'Tanaka', 'Ellery', 'Baptiste', 'Nakamura', 'Whitlock', 'Solano', 'Ferris',
]

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
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
export function generatePlayer(position: Position, rng: Rng, shift: number = 0): Player {
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

  const [minHeight, maxHeight] = HEIGHT_RANGE_INCHES[position]

  return {
    id: createId('player'),
    name: `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`,
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
