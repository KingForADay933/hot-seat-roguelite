import type { AttributeKey, Player } from '../../data/types'
import { shiftPlayerAttributes } from '../../engine/attributeShift'
import { ATTRIBUTE_CEILING, ATTRIBUTE_FLOOR } from '../../engine/constants'
import { clamp } from '../../engine/math'
import type { Rng } from '../../engine/rng'
import { pickDistinct } from './draftPool'

export type RosterQuirkId = 'stacked-guards' | 'aging-superstar' | 'low-ceiling'

export interface RosterQuirk {
  id: RosterQuirkId
  label: string
  description: string
}

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
}

function applyStackedGuards(players: Player[]): Player[] {
  return players.map((p) => {
    const position = p.positions[0]
    if (position === 'PG' || position === 'SG') return shiftPlayerAttributes(p, 12)
    if (position === 'PF' || position === 'C') return shiftPlayerAttributes(p, -12)
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

export function applyRosterQuirk(quirkId: RosterQuirkId, players: Player[], rng: Rng): Player[] {
  switch (quirkId) {
    case 'stacked-guards':
      return applyStackedGuards(players)
    case 'aging-superstar':
      return applyAgingSuperstar(players, rng)
    case 'low-ceiling':
      return applyLowCeiling(players, rng)
  }
}

/** Rolls `count` distinct candidates for the run-start roster-quirk draft (Section 8.2). */
export function pickRandomRosterQuirks(count: number, rng: Rng): RosterQuirkId[] {
  return pickDistinct(Object.keys(ROSTER_QUIRKS) as RosterQuirkId[], count, rng)
}
