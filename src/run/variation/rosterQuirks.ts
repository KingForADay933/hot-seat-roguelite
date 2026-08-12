import type { AttributeKey, Player } from '../../data/types'
import { shiftPlayerAttributes, shiftPlayerAttributesBy } from '../../engine/attributeShift'
import { ATTRIBUTE_CEILING, ATTRIBUTE_FLOOR } from '../../engine/constants'
import { deriveDepthChart } from '../../engine/depthChart'
import { average, clamp } from '../../engine/math'
import type { Rng } from '../../engine/rng'
import { FRANCHISE_PLAYER_MIN } from '../constants'
import { liftToOverall } from '../franchisePlayer'
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
  | 'glass-cannons'
  | 'one-superstar'
  | 'no-weak-links'

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
  'glass-cannons': {
    id: 'glass-cannons',
    label: 'Glass Cannons',
    description: 'A little more skill than you had a right to, and not a set of legs among them -- everyone here is gone by the fourth.',
  },
  'one-superstar': {
    id: 'one-superstar',
    label: 'One Random Superstar',
    description: 'One of your starters is a genuine star. The other eleven paid for him.',
  },
  'no-weak-links': {
    id: 'no-weak-links',
    label: 'No Weak Links',
    description: 'Nine men you can play and nobody who wins a game on his own -- your ninth is nearly your third.',
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

/**
 * How far above the floor Glass Cannons scatters its durability, and why the band is so narrow.
 *
 * Hidden traits share the [ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING] band every other rating uses --
 * engine/attributeShift.ts's shiftPlayerHiddenTrait clamps there and the generator rolls 40-90 -- so
 * a quirk cannot push one lower without widening a convention that coaching upgrades also rely on. It
 * does not need to: ui/playerTags.ts tags "Gasses Out" at 42, so the floor already lights up every
 * player on the roster, and the measured fatigue effect (below) is substantial there. The two-point
 * span is only so the Scouting table does not show twelve copies of one number.
 */
const DURABILITY_FLOOR_SPAN = 2

/**
 * What Glass Cannons buys with its legs, and why it is so much smaller than SKILL_TILT.
 *
 * Measured over 240 seeded games against an unmodified opponent: the durability floor on its own is
 * worth **-1.62 points a game**, and each attribute point handed back is worth about **+1.0**. So +2
 * lands the quirk at +0.45 relative to a baseline roster -- inside the -1.06..+0.94 band the existing
 * nine quirks already occupy (high-variance at the bottom, live-by-three at the top). +6, which is
 * what this constant started at, measured +3.96 and won 65% of its games.
 *
 * That the number is this small is a fact about the fatigue system rather than about the quirk: a
 * whole roster at the durability floor is worth under two points a game, so there is not much budget
 * to spend. **If fatigue is ever retuned, come back here** -- this constant is calibrated against it.
 *
 * The asymmetry is the other reason to keep it low. overallRating is the mean of the ten attributes
 * (engine/generator/randomPlayer.ts) and hidden traits never enter it, so the bonus is visible next to
 * every name on the roster table while the durability is only visible under Scouting and in the player
 * tags. A quirk that is both stronger than the pool and *looks* stronger is the worst of both.
 */
const GLASS_CANNON_BONUS = 2

function applyGlassCannons(players: Player[], rng: Rng): Player[] {
  return players.map((p) => ({
    ...shiftPlayerAttributes(p, GLASS_CANNON_BONUS),
    hidden: { ...p.hidden, durability: ATTRIBUTE_FLOOR + Math.floor(rng() * (DURABILITY_FLOOR_SPAN + 1)) },
  }))
}

/** How much of each player's distance from the roster mean No Weak Links keeps. At 0.35 a 14-point
 *  spread between the best and worst man comes back as 5. */
const NO_WEAK_LINKS_KEPT_SPREAD = 0.35

/** Bound on the band-sliding loop, for the same reason franchisePlayer.ts's LIFT_PASSES exists:
 *  attributes clamp, so one shift can land short of the target. */
const NO_WEAK_LINKS_PASSES = 3

/**
 * Pulls the roster in toward its own mean, then slides the whole band so the best man sits exactly at
 * FRANCHISE_PLAYER_MIN.
 *
 * The second step is what makes this quirk possible at all. A roster with genuinely no star would be
 * undone one line later: RunProvider applies the quirk and then calls ensureFranchisePlayer, which
 * would lift the best starter straight back to 82. Landing the top man *on* the threshold satisfies
 * that guarantee without it ever firing.
 *
 * Distinct from low-ceiling, which caps potential and leaves current ratings alone; this caps current
 * ratings and leaves potential alone. The team it produces is one where fatigue never forces a drop in
 * quality, because there is no drop to be had -- and where no single player wins a close game.
 */
function applyNoWeakLinks(players: Player[]): Player[] {
  if (players.length === 0) return players

  const mean = average(players.map((p) => p.overallRating))
  let out = players.map((p) => shiftPlayerAttributes(p, (mean - p.overallRating) * (1 - NO_WEAK_LINKS_KEPT_SPREAD)))

  for (let pass = 0; pass < NO_WEAK_LINKS_PASSES; pass++) {
    const top = Math.max(...out.map((p) => p.overallRating))
    if (top === FRANCHISE_PLAYER_MIN) break
    const next = out.map((p) => shiftPlayerAttributes(p, FRANCHISE_PLAYER_MIN - top))
    if (Math.max(...next.map((p) => p.overallRating)) === top) break
    out = next
  }
  return out
}

/**
 * What the other eleven give up so one of them can be a star.
 *
 * Measured over 240 seeded games at target 90: cost 0 is +1.09 relative to a baseline roster, cost 1
 * is +0.31, cost 2 is -0.67, cost 3 is -1.96. Two is the pick -- inside the -1.06..+0.94 band the
 * existing pool occupies, and on the paying side of it, which is the point of the quirk. Three, where
 * this started, is outside the band and simply a worse team.
 *
 * Landing slightly negative on single-game margin is deliberate rather than a concession. One player
 * covers about 36 of a team's 240 minutes, so concentrating talent cannot pay for itself inside one
 * game; what it buys is a player worth developing, worth drafting a system around, and worth spending
 * shop camps on -- none of which this measurement can see. high-variance sits at -1.06 for the same
 * kind of reason.
 */
const SUPERSTAR_SUPPORT_COST = 2
const SUPERSTAR_TARGET = 90

/** Drawn from the starting five rather than the roster at large, for the reason ensureFranchisePlayer
 *  gives: a 90 sitting behind a worse player is exactly the depth-chart inversion that release fixed.
 *  deriveDepthChart is the same function RunProvider calls on the way out of here, so the five this
 *  picks from and the five the GM is shown agree. */
function applyOneSuperstar(players: Player[], rng: Rng): Player[] {
  if (players.length === 0) return players

  const startingFive = new Set(deriveDepthChart(players).startingFive)
  const candidates = players.filter((p) => startingFive.has(p.id))
  const pool = candidates.length > 0 ? candidates : players
  const star = pool[Math.floor(rng() * pool.length)]

  return players.map((p) =>
    p.id === star.id ? liftToOverall(p, SUPERSTAR_TARGET) : shiftPlayerAttributes(p, -SUPERSTAR_SUPPORT_COST),
  )
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
    case 'glass-cannons':
      return applyGlassCannons(players, rng)
    case 'one-superstar':
      return applyOneSuperstar(players, rng)
    case 'no-weak-links':
      return applyNoWeakLinks(players)
  }
}

/** Rolls `count` distinct candidates for the run-start roster-quirk draft (Section 8.2). */
export function pickRandomRosterQuirks(count: number, rng: Rng): RosterQuirkId[] {
  return pickDistinct(Object.keys(ROSTER_QUIRKS) as RosterQuirkId[], count, rng)
}
