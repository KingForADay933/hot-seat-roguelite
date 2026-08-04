import type { PlayCallType } from './types'

export interface OffensivePlaybook {
  id: string
  name: string
  /** Relative weights per play call — needn't sum to 1.0, the selector normalizes. */
  weights: Record<PlayCallType, number>
  /** Multiplier applied to passing-dependent play calls (PnR, Spot-Up, Cutting). */
  ballMovementModifier: number
}

export interface DefensiveScheme {
  id: string
  name: string
  /** Switch-Everything: resistance uses the worst defender among the five, not the matched one. */
  weakLinkSensitive: boolean
  /** 0-1: weights Interior Defense/Vertical vs. Perimeter Defense/Lateral Quickness. High = Pack-the-Paint. */
  interiorFocus: number
  /** Scales turnover-forcing pressure. High = Full-Court Press. */
  pressureCoefficient: number
}

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
  },
}

export const DEFENSIVE_SCHEMES: Record<string, DefensiveScheme> = {
  manToMan: {
    id: 'manToMan',
    name: 'Man-to-Man',
    weakLinkSensitive: false,
    interiorFocus: 0.5,
    pressureCoefficient: 1.0,
  },
  zone: {
    id: 'zone',
    name: 'Zone',
    weakLinkSensitive: false,
    interiorFocus: 0.55,
    pressureCoefficient: 0.9,
  },
  switchEverything: {
    id: 'switchEverything',
    name: 'Switch-Everything',
    weakLinkSensitive: true,
    interiorFocus: 0.4,
    pressureCoefficient: 1.0,
  },
  packThePaint: {
    id: 'packThePaint',
    name: 'Pack-the-Paint',
    weakLinkSensitive: false,
    interiorFocus: 0.8,
    pressureCoefficient: 0.9,
  },
  fullCourtPress: {
    id: 'fullCourtPress',
    name: 'Full-Court Press',
    weakLinkSensitive: false,
    interiorFocus: 0.3,
    pressureCoefficient: 1.3,
  },
}
