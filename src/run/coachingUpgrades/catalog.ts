import type { Rng } from '../../engine/rng'
import { pickDistinct } from '../variation/draftPool'

export type CoachingUpgradeId =
  | 'clutch-gene'
  | 'iron-man-program'
  | 'film-study'
  | 'players-coach'
  | 'defensive-coordinator'
  | 'steady-hand'
  | 'player-development-guru'
  | 'bench-mob-mentality'
  | 'system-guru'

export interface CoachingUpgrade {
  id: CoachingUpgradeId
  label: string
  description: string
}

/** Section 8.6's first-pass pool of 9 -- each a one-time, permanent nudge to one rating/attribute
 *  the simulation already reads (see run/coachingUpgrades/applyCoachingUpgrade.ts for the effect
 *  each id actually applies). */
export const COACHING_UPGRADES: Record<CoachingUpgradeId, CoachingUpgrade> = {
  'clutch-gene': {
    id: 'clutch-gene',
    label: 'Clutch Gene',
    description: 'The whole roster tightens up, not loosens up, in crunch time.',
  },
  'iron-man-program': {
    id: 'iron-man-program',
    label: 'Iron Man Program',
    description: 'A conditioning regimen that keeps legs fresher, longer.',
  },
  'film-study': {
    id: 'film-study',
    label: 'Film Study',
    description: 'Hours in the tape room mean sharper decisions with the ball -- fewer live-ball turnovers.',
  },
  'players-coach': {
    id: 'players-coach',
    label: "Players' Coach",
    description: 'A staff the roster actually wants to play for -- a lasting boost to system buy-in.',
  },
  'defensive-coordinator': {
    id: 'defensive-coordinator',
    label: 'Defensive Coordinator',
    description: 'A dedicated defensive mind sharpens the whole roster on that end of the floor.',
  },
  'steady-hand': {
    id: 'steady-hand',
    label: 'Steady Hand',
    description: 'Fewer off nights -- the roster plays closer to its true level, good or bad.',
  },
  'player-development-guru': {
    id: 'player-development-guru',
    label: 'Player Development Guru',
    description: "A staff addition built around one thing: getting more out of every player's growth.",
  },
  'bench-mob-mentality': {
    id: 'bench-mob-mentality',
    label: 'Bench Mob Mentality',
    description: 'The current bench unit buys in and plays above its own numbers.',
  },
  'system-guru': {
    id: 'system-guru',
    label: 'System Guru',
    description: "A deeper mastery of the roster's drafted system than the roster found on its own.",
  },
}

/** Rolls `count` distinct candidates for a shop visit's coaching-upgrade offer, excluding cards
 *  already owned this run -- each card is buyable once ever, no stacking. Returns fewer than
 *  `count` (down to 0) once the pool is exhausted, rather than throwing like pickDistinct would. */
export function pickCoachingUpgradeOffers(owned: CoachingUpgradeId[], count: number, rng: Rng): CoachingUpgradeId[] {
  const available = (Object.keys(COACHING_UPGRADES) as CoachingUpgradeId[]).filter((id) => !owned.includes(id))
  return pickDistinct(available, Math.min(count, available.length), rng)
}
