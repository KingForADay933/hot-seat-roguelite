import type { DefensiveScheme, OffensivePlaybook } from '../data/presets'
import type { PlayCallType, TacticalFocus } from '../data/types'
import {
  FOCUS_DEFENSIVE_TILT,
  FOCUS_GLASS_REBOUND_OFFSET,
  FOCUS_GLASS_CRASH_RESISTANCE,
  FOCUS_GLASS_GET_BACK_RESISTANCE,
  FOCUS_PACE_DURATION_SCALE,
  FOCUS_PACE_EFFICIENCY,
  FOCUS_SHOT_SELECTION_LEAN,
} from './constants'
import { clamp } from './math'

/**
 * The one place a tactical dial becomes a number (data/types/team.ts's TacticalFocus).
 *
 * Every function here is pure and every one returns an identity result for a balanced dial, which is
 * what lets `Team.tacticalFocus` be optional: an absent focus and an all-balanced focus produce the
 * same game from the same seed, so no existing save, seed or calibration figure moves.
 *
 * Kept out of the possession modules on purpose. Those answer "how does this possession resolve";
 * this answers "what did the coach ask for", and holding the two apart is what keeps the dials to a
 * set of offsets rather than a second resolution model growing alongside the first.
 */

/**
 * How much of a rim attack each play call is, in *this* engine rather than in general.
 *
 * Worth stating because the modern-basketball reading is misleading here: `spot-up` is the only call
 * that always produces a three (playerSelector.ts's `isOutsideShotAction`), `isolation` produces one
 * only when the handler shoots better outside than in, and `transition` is a two -- a runout finished
 * at the rim, not a trailer triple. So hunting threes means running spot-ups, and it costs transition
 * rather than buying it.
 */
const RIM_LEAN: Record<PlayCallType, number> = {
  'post-up': 1,
  cutting: 1,
  'pick-and-roll': 0.5,
  transition: 0.5,
  isolation: 0,
  'spot-up': -1,
}

/**
 * The playbook this team is actually running, after shot selection leans it.
 *
 * **Multiplicative, never additive.** Six of the nine systems leave at least one play call at zero
 * and `selectPlayCall` filters those out, so scaling means a focus can never manufacture a play the
 * system does not run: Twin Towers hunting threes shifts weight between its post-ups, rolls and
 * spot-ups and still cannot produce a single transition possession. The drafted system stays the
 * identity and the dial only says how to emphasise it, which is the separation m3-tactical-axis.md's
 * D2 turns on.
 *
 * Returns the same reference when balanced, so a caller can cheaply tell nothing changed.
 */
export function focusedPlaybook(playbook: OffensivePlaybook, focus: TacticalFocus | undefined): OffensivePlaybook {
  const direction = focus?.shotSelection === 'rim' ? 1 : focus?.shotSelection === 'threes' ? -1 : 0
  if (direction === 0) return playbook

  const weights = { ...playbook.weights }
  for (const call of Object.keys(weights) as PlayCallType[]) {
    weights[call] = Math.max(0, weights[call] * (1 + FOCUS_SHOT_SELECTION_LEAN * RIM_LEAN[call] * direction))
  }
  return { ...playbook, weights }
}

/**
 * What the glass dial does to this team's resistance on the one possession that follows their own
 * missed shot -- the trip where crashing means they are not back yet and getting back means they
 * are. 1 when balanced, so the whole mechanism is a no-op for a team that has not touched the dial.
 *
 * Charged as resistance rather than as a grant of transition play calls, which is what the first
 * version did. Measurement rejected that: transition is the *least* efficient call in the engine
 * (0.872 PPP against spot-up's 1.134), so giving the rebounding team more of it rewarded the
 * crasher instead of charging them, and Crash won every cell of a four-system sweep. A fast break
 * is not a play call in this model -- it is a defense that has not got back, which is exactly what a
 * resistance multiplier says.
 */
export function fastBreakResistanceScale(focus: TacticalFocus | undefined): number {
  if (focus?.glass === 'crash') return FOCUS_GLASS_CRASH_RESISTANCE
  if (focus?.glass === 'getBack') return FOCUS_GLASS_GET_BACK_RESISTANCE
  return 1
}

/**
 * The scheme's interior/perimeter balance after the defensive tilt.
 *
 * resistance.ts's `applyInteriorFocus` multiplies by `(interiorFocus - 0.5) * flag`, where the flag
 * is +1 for interior actions and -1 for perimeter ones -- so this is symmetric for free: every point
 * gained inside is conceded outside. Clamped to 0.1-0.9 so a tilted Pack-the-Paint or Full-Court
 * Press stays inside the range that formula was reasoned on.
 */
export function focusedInteriorFocus(scheme: DefensiveScheme, focus: TacticalFocus | undefined): number {
  const direction = focus?.defensiveTilt === 'paint' ? 1 : focus?.defensiveTilt === 'perimeter' ? -1 : 0
  if (direction === 0) return scheme.interiorFocus
  return clamp(scheme.interiorFocus + FOCUS_DEFENSIVE_TILT * direction, 0.1, 0.9)
}

/** Multiplier on a sampled possession duration: pushing shortens the trip, controlling lengthens it.
 *  1 when balanced. */
export function focusPaceScale(focus: TacticalFocus | undefined): number {
  if (focus?.pace === 'push') return 1 - FOCUS_PACE_DURATION_SCALE
  if (focus?.pace === 'control') return 1 + FOCUS_PACE_DURATION_SCALE
  return 1
}

/**
 * The efficiency half of the pace trade, as a multiplier on offense strength. 1 when balanced.
 *
 * Without it, pace has only a volume effect, which makes pushing simply correct for the better team
 * and simply wrong for the worse one -- a question answered once per run instead of per opponent.
 * Rushed looks cost a little; working the clock buys the same back.
 */
export function focusPaceEfficiency(focus: TacticalFocus | undefined): number {
  if (focus?.pace === 'push') return 1 - FOCUS_PACE_EFFICIENCY
  if (focus?.pace === 'control') return 1 + FOCUS_PACE_EFFICIENCY
  return 1
}

/**
 * The dials an AI team plays with, read off the system it was given.
 *
 * Derived rather than rolled, for two reasons. Drawing from `rng` in randomLeague would shift the
 * random stream and invalidate every existing seed in the suite -- the position-fit distribution
 * test, the scoring calibration, and the seeded cases that already had to be rewritten once when
 * league-wide unique names moved the stream. This costs no draws at all.
 *
 * And it reads better on a scouting report. A rolled dial would hand Twin Towers "Hunt Threes",
 * which is nonsense a GM would rightly distrust; derived, a 7 Seconds or Less team scouts as pushing
 * the tempo and hunting its shooters, and Grit and Grind as working the clock and attacking the rim.
 * The identity and the dials agree, which is what makes the report worth opening.
 *
 * Only genuinely lopsided systems get a lean. The rest stay balanced, so most of the league is
 * unchanged from before focus points existed and the leans that do exist mean something.
 */
export function focusForSystem(offensiveStrategyId: string): TacticalFocus | undefined {
  switch (offensiveStrategyId) {
    case 'sevenSecondsOrLess':
      return { pace: 'push', shotSelection: 'threes', defensiveTilt: 'perimeter', glass: 'getBack' }
    case 'paceAndSpace':
      return { pace: 'push', shotSelection: 'threes', defensiveTilt: 'perimeter', glass: 'balanced' }
    case 'twinTowers':
      return { pace: 'control', shotSelection: 'rim', defensiveTilt: 'paint', glass: 'crash' }
    case 'gritAndGrind':
      return { pace: 'control', shotSelection: 'rim', defensiveTilt: 'paint', glass: 'crash' }
    case 'princeton':
      return { pace: 'control', shotSelection: 'balanced', defensiveTilt: 'balanced', glass: 'getBack' }
    default:
      return undefined
  }
}

/** Added to the offensive rebound probability for the team on offense. 0 when balanced. */
export function focusReboundOffset(focus: TacticalFocus | undefined): number {
  if (focus?.glass === 'crash') return FOCUS_GLASS_REBOUND_OFFSET
  if (focus?.glass === 'getBack') return -FOCUS_GLASS_REBOUND_OFFSET
  return 0
}

