import type { PlayCallType } from './types'

export interface OffensivePlaybook {
  id: string
  name: string
  /** Relative weights per play call — needn't sum to 1.0, the selector normalizes. */
  weights: Record<PlayCallType, number>
  /** Multiplier applied to passing-dependent play calls (PnR, Spot-Up, Cutting). */
  ballMovementModifier: number
  description: string
}

/** Keys of DEFENSIVE_SCHEMES -- the same standalone-literal treatment SystemId gets below, and for
 *  the same reason: the run's defensive draft (run/variation/defenseDraft.ts) needs the narrow type
 *  while every existing Record<string, ...> consumer stays untouched. */
export type DefensiveSchemeId = 'manToMan' | 'zone' | 'switchEverything' | 'packThePaint' | 'fullCourtPress'

export interface DefensiveScheme {
  id: string
  name: string
  /** GM-facing summary of the trade the scheme makes, for the draft card. */
  description: string
  /** Switch-Everything: resistance uses the worst defender among the five, not the matched one. */
  weakLinkSensitive: boolean
  /** 0-1: weights Interior Defense/Vertical vs. Perimeter Defense/Lateral Quickness. High = Pack-the-Paint. */
  interiorFocus: number
  /** Scales turnover-forcing pressure. High = Full-Court Press. */
  pressureCoefficient: number
}

/** Keys of OFFENSIVE_PLAYBOOKS -- kept as a standalone literal type (rather than retyping
 *  OFFENSIVE_PLAYBOOKS itself to Record<SystemId, ...>) so every existing Record<string, ...>-typed
 *  consumer (randomLeague's pickKey, simulateGame's OFFENSIVE_PLAYBOOKS[team.offensiveStrategyId])
 *  is untouched -- only the roguelite system draft (run/variation/systemDraft.ts) needs the
 *  narrower type, to keep its candidate arrays type-safe. */
export type SystemId =
  | 'motion'
  | 'isoHeavy'
  | 'balanced'
  | 'paceAndSpace'
  | 'sevenSecondsOrLess'
  | 'princeton'
  | 'triangle'
  | 'gritAndGrind'
  | 'twinTowers'

export const OFFENSIVE_PLAYBOOKS: Record<string, OffensivePlaybook> = {
  motion: {
    id: 'motion',
    name: 'Motion Offense',
    weights: {
      cutting: 0.3,
      'spot-up': 0.25,
      'pick-and-roll': 0.2,
      'post-up': 0.15,
      isolation: 0.1,
      transition: 0,
    },
    ballMovementModifier: 1.15,
    description: 'Cutters and shooters constantly moving without the ball.',
  },
  isoHeavy: {
    id: 'isoHeavy',
    name: 'Iso-Heavy',
    weights: {
      isolation: 0.45,
      'post-up': 0.2,
      'pick-and-roll': 0.2,
      'spot-up': 0.15,
      cutting: 0,
      transition: 0,
    },
    ballMovementModifier: 0.85,
    description: 'Clear out and let your best scorer cook one-on-one.',
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced Attack',
    weights: {
      'pick-and-roll': 0.25,
      'spot-up': 0.2,
      isolation: 0.2,
      'post-up': 0.15,
      cutting: 0.15,
      transition: 0.05,
    },
    ballMovementModifier: 1.0,
    description: 'No single identity -- a bit of everything.',
  },
  paceAndSpace: {
    id: 'paceAndSpace',
    name: 'Pace and Space',
    weights: {
      'spot-up': 0.3,
      transition: 0.2,
      'pick-and-roll': 0.25,
      cutting: 0.15,
      isolation: 0.1,
      'post-up': 0,
    },
    ballMovementModifier: 1.1,
    description: 'Spread the floor and push in transition whenever possible.',
  },
  sevenSecondsOrLess: {
    id: 'sevenSecondsOrLess',
    name: '7 Seconds or Less',
    weights: {
      transition: 0.35,
      'spot-up': 0.3,
      'pick-and-roll': 0.2,
      cutting: 0.1,
      isolation: 0.05,
      'post-up': 0,
    },
    ballMovementModifier: 1.25,
    description: 'Push pace on every possession, spot-up off it.',
  },
  princeton: {
    id: 'princeton',
    name: 'Princeton',
    weights: {
      cutting: 0.35,
      'spot-up': 0.25,
      'pick-and-roll': 0.2,
      'post-up': 0.15,
      isolation: 0.05,
      transition: 0,
    },
    ballMovementModifier: 1.2,
    description: 'Backdoor cuts, deliberate half-court passing.',
  },
  triangle: {
    id: 'triangle',
    name: 'Triangle',
    weights: {
      'post-up': 0.35,
      cutting: 0.25,
      'spot-up': 0.2,
      'pick-and-roll': 0.15,
      isolation: 0.05,
      transition: 0,
    },
    ballMovementModifier: 1.1,
    description: 'Post entries feeding cutters and shooters.',
  },
  gritAndGrind: {
    id: 'gritAndGrind',
    name: 'Grit and Grind',
    weights: {
      'post-up': 0.4,
      isolation: 0.35,
      'pick-and-roll': 0.15,
      'spot-up': 0.1,
      cutting: 0,
      transition: 0,
    },
    ballMovementModifier: 0.75,
    description: 'Grind it out on the block, minimal ball movement.',
  },
  twinTowers: {
    id: 'twinTowers',
    name: 'Twin Towers',
    weights: {
      'post-up': 0.5,
      'pick-and-roll': 0.25,
      'spot-up': 0.15,
      cutting: 0.1,
      isolation: 0,
      transition: 0,
    },
    ballMovementModifier: 0.9,
    description: 'Feed the bigs -- everything runs through the post.',
  },
}

export const DEFENSIVE_SCHEMES: Record<string, DefensiveScheme> = {
  manToMan: {
    id: 'manToMan',
    name: 'Man-to-Man',
    description: 'Everyone guards their own. No strengths, no holes -- each man is judged on the matchup he was given.',
    weakLinkSensitive: false,
    interiorFocus: 0.5,
    pressureCoefficient: 1.0,
  },
  zone: {
    id: 'zone',
    name: 'Zone',
    weakLinkSensitive: false,
    description: 'Guard space instead of men. Tilts slightly inside and gives up a little ball pressure for the shape.',
    interiorFocus: 0.55,
    pressureCoefficient: 0.9,
  },
  switchEverything: {
    id: 'switchEverything',
    name: 'Switch-Everything',
    description: 'Switch every screen, so the offense picks who defends. Your worst defender takes the possession -- five real defenders or it is a liability.',
    weakLinkSensitive: true,
    interiorFocus: 0.4,
    pressureCoefficient: 1.0,
  },
  packThePaint: {
    id: 'packThePaint',
    name: 'Pack-the-Paint',
    description: 'Wall off the rim and live with the jumper. Much stronger inside, and forgiving of weak perimeter defenders.',
    weakLinkSensitive: false,
    interiorFocus: 0.8,
    pressureCoefficient: 0.9,
  },
  fullCourtPress: {
    id: 'fullCourtPress',
    name: 'Full-Court Press',
    description: 'Hound the ball for 94 feet. Turns quick, athletic defenders into turnovers -- and hands the game away if they are not.',
    weakLinkSensitive: false,
    interiorFocus: 0.3,
    pressureCoefficient: 1.3,
  },
}
