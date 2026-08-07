import type { Rng } from '../../engine/rng'
import { pickDistinct } from '../variation/draftPool'

export type ConsumableId =
  | 'sports-psych-session'
  | 'load-management'
  | 'film-room-marathon'
  | 'energy-drink-sponsorship'
  | 'extra-shootaround'
  | 'defensive-bootcamp'
  | 'lucky-jersey'

export interface Consumable {
  id: ConsumableId
  label: string
  description: string
}

/** Section 8.7's first-pass pool of 7 -- each a cheap, single-season effect (see
 *  run/consumables/applyConsumableEffect.ts for what each id actually applies), held in a capped
 *  inventory and burned before the season the GM wants it active for. */
export const CONSUMABLES: Record<ConsumableId, Consumable> = {
  'sports-psych-session': {
    id: 'sports-psych-session',
    label: 'Sports Psych Session',
    description: 'A mental-game tune-up -- the roster tightens up in crunch time for one season.',
  },
  'load-management': {
    id: 'load-management',
    label: 'Load Management',
    description: 'A carefully managed workload keeps legs fresher for one season.',
  },
  'film-room-marathon': {
    id: 'film-room-marathon',
    label: 'Film Room Marathon',
    description: 'A season-long crash course in ball security.',
  },
  'energy-drink-sponsorship': {
    id: 'energy-drink-sponsorship',
    label: 'Energy Drink Sponsorship',
    description: 'Cash in a one-time sponsorship deal for an immediate budget bump.',
  },
  'extra-shootaround': {
    id: 'extra-shootaround',
    label: 'Extra Shootaround',
    description: "A season's worth of extra reps sharpens the whole roster's shot.",
  },
  'defensive-bootcamp': {
    id: 'defensive-bootcamp',
    label: 'Defensive Bootcamp',
    description: 'A short, intense camp sharpens the roster on the defensive end for one season.',
  },
  'lucky-jersey': {
    id: 'lucky-jersey',
    label: 'Lucky Jersey',
    description: 'Superstition or not, the whole roster plays a little looser for one season.',
  },
}

/** Rolls `count` distinct candidates for a shop visit's consumable offer. Unlike coaching
 *  upgrades' pickCoachingUpgradeOffers, there's no "exclude already owned" filter -- duplicates in
 *  inventory are fine, so every card is always eligible to be offered again. */
export function pickConsumableOffers(count: number, rng: Rng): ConsumableId[] {
  return pickDistinct(Object.keys(CONSUMABLES) as ConsumableId[], count, rng)
}
