import type { AttributeKey, Player } from '../../data/types'
import { shiftPlayerAttributes, shiftPlayerAttributesBy } from '../../engine/attributeShift'
import { ATTRIBUTE_CEILING, ATTRIBUTE_FLOOR } from '../../engine/constants'
import { clamp } from '../../engine/math'
import type { Rng } from '../../engine/rng'
import { pickDistinct } from './draftPool'

export type RosterQuirkId =
  | 'stacked-guards'
  | 'aging-superstar'
  | 'low-ceiling'
  | 'frontcourt-overload'
  | 'live-by-three'
  | 'defense-first'
  | 'undersized-fast'
  | 'all-prime'
  | 'high-variance'

export interface RosterQuirk {
  id: RosterQuirkId
  label: string
  description: string
}

/**
 * How hard a positional quirk tilts a roster. Applied as +N to the favoured group and -N to the
 * other, so the roster's overall quality is unchanged and only its *shape* moves -- a quirk is a
 * different team to coach, not a harder or easier one.
 */
const POSITION_TILT = 12

/**
 * The same idea one axis over: a skill-shape quirk spends the boost on one or two attributes and
 * pays for it out of the opposing ones. Kept net-zero across the ten attributes (one +16 or two +8
 * against two -8) so these sit at the same severity as the positional tilt above, which matters
 * because they share a draft pool and the GM only ever sees two of them.
 */
const SKILL_TILT = 8

export const ROSTER_QUIRKS: Record<RosterQuirkId, RosterQuirk> = {
  'stacked-guards': {
    id: 'stacked-guards',
    label: 'Stacked at Guard',
    description: 'Elite backcourt, thin frontcourt -- your guards can play, your bigs cannot.',
  },
  'aging-superstar': {
    id: 'aging-superstar',
    label: 'One Aging Superstar',
    description: 'A star well past his prime carrying a roster of rookies who need years to catch up.',
  },
  'low-ceiling': {
    id: 'low-ceiling',
    label: 'Balanced, Low Ceiling',
    description: "Nobody's bad, nobody's got much more in the tank -- what you see is what you get.",
  },
  'frontcourt-overload': {
    id: 'frontcourt-overload',
    label: 'Frontcourt Overload',
    description: 'Bigs three deep and nobody who can create off the dribble -- size you have to find shots for.',
  },
  'live-by-three': {
    id: 'live-by-three',
    label: 'Live by the Three',
    description: 'Shooters everywhere, but nobody finishes at the rim and nobody protects it either.',
  },
  'defense-first': {
    id: 'defense-first',
    label: 'Defense Wins Championships',
    description: 'They guard everyone and score on no one -- every night is a rock fight.',
  },
  'undersized-fast': {
    id: 'undersized-fast',
    label: 'Undersized and Fast',
    description: 'Quick everywhere, small everywhere -- you will win the open floor and lose the glass.',
  },
  'all-prime': {
    id: 'all-prime',
    label: 'All Prime, No Upside',
    description: 'Nobody is a rookie and nobody is declining. This roster is exactly what it will always be.',
  },
  'high-variance': {
    id: 'high-variance',
    label: 'High-Variance Roster',
    description: 'A couple of genuine lottery tickets, a couple who may never contribute, nothing in between.',
  },
}

/** Tilts a roster toward one end of the position order and away from the other. SF is left alone by
 *  both directions -- it's the hinge the tilt turns around, and a wing who stays average is what
 *  makes the imbalance legible rather than just "everyone shifted." */
function applyPositionTilt(players: Player[], favoured: 'backcourt' | 'frontcourt'): Player[] {
  const guardShift = favoured === 'backcourt' ? POSITION_TILT : -POSITION_TILT
  return players.map((p) => {
    const position = p.positions[0]
    if (position === 'PG' || position === 'SG') return shiftPlayerAttributes(p, guardShift)
    if (position === 'PF' || position === 'C') return shiftPlayerAttributes(p, -guardShift)
    return p
  })
}

/** One roster-best player becomes an aging elite talent; everyone else becomes a young rookie --
 *  matches the design doc's "one aging superstar, rest are rookies" example directly. */
function applyAgingSuperstar(players: Player[], rng: Rng): Player[] {
  if (players.length === 0) return players
  const star = players.reduce((best, p) => (p.overallRating > best.overallRating ? p : best))

  return players.map((p) => {
    if (p.id === star.id) {
      const elevated = shiftPlayerAttributes(p, 20)
      return { ...elevated, age: 34 + Math.floor(rng() * 3), development: { ...elevated.development, ageCurveStage: 'declining' } }
    }
    return { ...p, age: 19 + Math.floor(rng() * 3), development: { ...p.development, ageCurveStage: 'rising' } }
  })
}

/** Caps every player's growth headroom close to their current attributes -- the roster won't get
 *  meaningfully better over the course of a run, matching "balanced but low-ceiling." */
function applyLowCeiling(players: Player[], rng: Rng): Player[] {
  return players.map((p) => {
    const potential = { ...p.development.potential }
    for (const key of Object.keys(potential) as AttributeKey[]) {
      potential[key] = clamp(p.attributes[key] + Math.round(rng() * 4), ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING)
    }
    return { ...p, development: { ...p.development, potential } }
  })
}

/** Inches taken off every player. Height never reaches the simulation while a player is in his own
 *  slot (engine/positionFit.ts's effectivePlayer is a no-op there), so this is not a second nerf on
 *  top of the attribute trade -- it makes the roster *read* as small on the player pages, and it
 *  does bite if the GM charts one of these players out of position, where a body now sitting below
 *  its band's floor counts as a Specialist and slides worse. */
const UNDERSIZED_INCHES = 3

/** Ages every player lands in under All Prime -- old enough that nothing is still coming, young
 *  enough that nothing has started going. */
const PRIME_AGE_MIN = 26
const PRIME_AGE_SPAN = 4

/** How many players at each end of the roster High-Variance pushes apart, and by how much. The
 *  upside is bought as potential (it has to be *developed*, which is the gamble) while the downside
 *  is taken in current attributes (it is felt immediately, which is the cost). */
const VARIANCE_TAIL_COUNT = 2
const VARIANCE_UPSIDE = 24
const VARIANCE_DOWNSIDE = 14

/** Spends the boost on one group of attributes and pays for it out of the opposing group -- the
 *  shared shape behind the three skill-type quirks. */
function applySkillTilt(players: Player[], up: AttributeKey[], down: AttributeKey[]): Player[] {
  // Net-zero across the roster: whatever the raised attributes gain in total, the lowered ones give
  // back, so a skill quirk changes what a team is good at without changing how good it is.
  const gainEach = (SKILL_TILT * down.length) / up.length
  const shifts: Partial<Record<AttributeKey, number>> = {}
  for (const key of up) shifts[key] = gainEach
  for (const key of down) shifts[key] = -SKILL_TILT
  return players.map((p) => shiftPlayerAttributesBy(p, shifts))
}

/** Everyone lands in their prime with their potential already reached -- no rookies to develop, no
 *  veterans to lose. Unlike low-ceiling (which caps growth but leaves the age curve alone, so old
 *  players still decline), this freezes the roster in both directions for the rest of the run. */
function applyAllPrime(players: Player[], rng: Rng): Player[] {
  return players.map((p) => ({
    ...p,
    age: PRIME_AGE_MIN + Math.floor(rng() * PRIME_AGE_SPAN),
    development: {
      ...p.development,
      ageCurveStage: 'peak' as const,
      potential: { ...p.attributes },
    },
  }))
}

/** Pushes the roster's two ends apart: the best two get real star potential to grow into, the worst
 *  two get worse and stay there. The middle is untouched, so the spread is the point rather than a
 *  general rise or fall. */
function applyHighVariance(players: Player[]): Player[] {
  const ranked = [...players].sort((a, b) => b.overallRating - a.overallRating)
  const risers = new Set(ranked.slice(0, VARIANCE_TAIL_COUNT).map((p) => p.id))
  // Taken from the back of the ranking, and excluding anyone already counted as a riser -- on a
  // roster of four or fewer the two ends would otherwise overlap and cancel each other out.
  const fallers = new Set(
    ranked
      .slice(-VARIANCE_TAIL_COUNT)
      .filter((p) => !risers.has(p.id))
      .map((p) => p.id),
  )

  return players.map((p) => {
    if (risers.has(p.id)) {
      const potential = { ...p.development.potential }
      for (const key of Object.keys(potential) as AttributeKey[]) {
        potential[key] = clamp(p.attributes[key] + VARIANCE_UPSIDE, ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING)
      }
      return { ...p, development: { ...p.development, potential } }
    }
    if (fallers.has(p.id)) {
      const lowered = shiftPlayerAttributes(p, -VARIANCE_DOWNSIDE)
      return { ...lowered, development: { ...lowered.development, potential: { ...lowered.attributes } } }
    }
    return p
  })
}

export function applyRosterQuirk(quirkId: RosterQuirkId, players: Player[], rng: Rng): Player[] {
  switch (quirkId) {
    case 'stacked-guards':
      return applyPositionTilt(players, 'backcourt')
    case 'frontcourt-overload':
      return applyPositionTilt(players, 'frontcourt')
    case 'aging-superstar':
      return applyAgingSuperstar(players, rng)
    case 'low-ceiling':
      return applyLowCeiling(players, rng)
    case 'live-by-three':
      return applySkillTilt(players, ['outsideShot'], ['insideShot', 'interiorDefense'])
    case 'defense-first':
      return applySkillTilt(players, ['perimeterDefense', 'interiorDefense'], ['insideShot', 'outsideShot'])
    case 'undersized-fast':
      return applySkillTilt(players, ['speed', 'lateralQuickness'], ['rebounding', 'interiorDefense']).map((p) => ({
        ...p,
        heightInches: p.heightInches - UNDERSIZED_INCHES,
      }))
    case 'all-prime':
      return applyAllPrime(players, rng)
    case 'high-variance':
      return applyHighVariance(players)
  }
}

/** Rolls `count` distinct candidates for the run-start roster-quirk draft (Section 8.2). */
export function pickRandomRosterQuirks(count: number, rng: Rng): RosterQuirkId[] {
  return pickDistinct(Object.keys(ROSTER_QUIRKS) as RosterQuirkId[], count, rng)
}
