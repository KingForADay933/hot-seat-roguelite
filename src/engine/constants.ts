import type { TendencyProfile } from '../data/types'

/** All formula weights live here so balance tuning is a config change, not a code change. */

// --- Attribute generation (2K-style rating scale: 40 floor, ~70 = decent, 80+ = good-great, 90+ = elite) ---

/** Hard floor/ceiling for every core attribute -- generation, growth, and decay all agree on this. */
export const ATTRIBUTE_FLOOR = 40
export const ATTRIBUTE_CEILING = 99
export const ATTRIBUTE_BASELINE_SPAN = ATTRIBUTE_CEILING - ATTRIBUTE_FLOOR
/** Chance a rolled attribute ignores the bell curve entirely and becomes a signature elite skill. */
export const ATTRIBUTE_STANDOUT_CHANCE = 0.05
export const ATTRIBUTE_STANDOUT_MIN = 90
export const ATTRIBUTE_STANDOUT_SPAN = 9

export const POSSESSION_STRENGTH_WEIGHTS = {
  pickAndRoll: { handlerBallHandling: 0.35, handlerPassing: 0.25, rollerInsideShot: 0.25, rollerVertical: 0.15 },
  isolation: { ballHandling: 0.4, shot: 0.35, shotSelection: 0.25 },
  postUp: { insideShot: 0.6, vertical: 0.4 },
  spotUp: { outsideShot: 0.55, creatorPassing: 0.45 },
  cutting: { speed: 0.5, passingAvg: 0.5 },
  transition: { speed: 0.4, passing: 0.3, teamRebounding: 0.3 },
} as const

export const RESISTANCE_WEIGHTS = {
  pickAndRoll: { handlerLateral: 0.4, handlerPerimeter: 0.3, rollerInterior: 0.3 },
  isolationPerimeter: { lateral: 0.6, perimeter: 0.4 },
  isolationInterior: { interior: 0.6, vertical: 0.4 },
  postUp: { interior: 0.6, vertical: 0.4 },
  transition: { speed: 0.5, lateral: 0.5 },
} as const

/** Scales the full-court-press-style backcourt pressure term applied to every possession. */
export const PRESS_RESISTANCE_SCALE = 0.15

/**
 * Substitutes for the design doc's undefined "IQ" dependency (Section 5.2 lists IQ for
 * Isolation shot selection, but IQ isn't a defined attribute). Tendencies already exists
 * as a hidden trait, so it's reused here rather than inventing an 11th attribute.
 */
export const TENDENCY_SHOT_SELECTION: Record<TendencyProfile, number> = {
  'pass-first': 65,
  balanced: 60,
  'shoot-first': 50,
}

export const TURNOVER_BASE_PROB = 0.1
export const TURNOVER_MIN = 0.04
export const TURNOVER_MAX = 0.22
export const TURNOVER_SENSITIVITY = 500

export const MAKE_PROB_BASE = 0.45
export const MAKE_PROB_MARGIN_SCALE = 200
export const MAKE_PROB_MIN = 0.05
export const MAKE_PROB_MAX = 0.85

export const FOUL_PROB_BASE = 0.12
export const FOUL_PROB_INTERIOR_BONUS = 0.08

export const CONSISTENCY_NOISE_MAX = 12
export const CLUTCH_BONUS_MAX = 6
export const CLUTCH_POSSESSION_WINDOW_FRACTION = 0.05
export const CLUTCH_SCORE_MARGIN = 5

/**
 * Controls how concentrated offensive usage (who gets picked as the ball-handler/shooter/etc.
 * for a given play call) is around the best-fit player. Selection weight is fitScore^exponent,
 * so higher values concentrate usage more heavily on the top option; 1 would be close to
 * proportional-to-skill, and very high values approach the old "always pick the best" behavior.
 * Tunable here rather than in code -- a placeholder for a future per-team/per-player usage system.
 */
export const USAGE_WEIGHT_EXPONENT = 3

// --- Schedule generation ---

/** Weighted round-to-round gap in days: mostly a normal rest day or two, occasionally a
 *  back-to-back (1) or an extra day off (3). Weighted average ~2.05 days/round, matching the real
 *  NBA's ~2.07 days/game pace (82 games over ~170 days). */
export const SCHEDULE_GAP_DAYS = [1, 2, 3] as const
export const SCHEDULE_GAP_WEIGHTS = [0.15, 0.65, 0.2] as const

// --- Bench rotation / fatigue ---

/** Standard game length in minutes. Converts on-court possession counts <-> minutes. */
export const REGULATION_MINUTES = 48

/** Real-NBA overtime length: 5 minutes per extra period, at the same pace as regulation. */
export const OVERTIME_MINUTES = 5

/** Relative target-minutes share by depth-chart rank within a position group (0 = starter),
 *  normalized to sum to REGULATION_MINUTES across however many players occupy that group. */
export const ROTATION_DEPTH_WEIGHTS = [1.0, 0.5, 0.2, 0.1, 0.05]

/** Fatigue points gained per possession played, at DURABILITY_NEUTRAL. Tuned so a continuously-
 *  playing average-durability player hits FATIGUE_SUB_OUT_THRESHOLD (80) after roughly an
 *  18-possession shift (~8.6 minutes at the default 100-possession pace) -- a realistic shift. */
export const FATIGUE_GAIN_BASE = 4.5

/** Fatigue points recovered per possession benched, at DURABILITY_NEUTRAL. Set above the gain
 *  rate so a maxed-out player (80) drops under FATIGUE_SUB_IN_MAX (30) in about 10 possessions
 *  (~4.8 minutes) of rest. */
export const FATIGUE_RECOVERY_BASE = 5.0

/** Durability value at which the gain/recovery multiplier is exactly 1 -- the midpoint of
 *  hidden.durability's 40-90 generation range (generator/randomPlayer.ts). */
export const DURABILITY_NEUTRAL = 65

/** Each durability point above/below DURABILITY_NEUTRAL shifts gain down / recovery up by 0.6%.
 *  At the generation extremes (durability 40 or 90) this is a +-15% swing. */
export const FATIGUE_DURABILITY_FACTOR = 0.006
export const FATIGUE_MULT_MIN = 0.7
export const FATIGUE_MULT_MAX = 1.3

/** Fatigue (0-100) at which an on-court player becomes eligible to be subbed out. */
export const FATIGUE_SUB_OUT_THRESHOLD = 80

/** Fatigue so high a player is pulled immediately, bypassing MIN_SHIFT_POSSESSIONS's cooldown. */
export const FATIGUE_EMERGENCY_THRESHOLD = 95

/** A bench player must be rested to at or below this to be sub-in eligible -- left well below
 *  FATIGUE_SUB_OUT_THRESHOLD so a just-subbed-out player can never immediately re-qualify. */
export const FATIGUE_SUB_IN_MAX = 30

/** Possessions a player must stay on court after entering before being re-evaluated for a
 *  sub-out (except via FATIGUE_EMERGENCY_THRESHOLD) -- prevents rapid in/out thrashing when
 *  fatigue or pace sits right at a threshold boundary. */
export const MIN_SHIFT_POSSESSIONS = 6

/** Possessions-elapsed-so-far below which the pace-overage trigger is skipped entirely -- avoids
 *  dividing by a tiny/zero possession count early in the game. */
export const PACE_CHECK_MIN_POSSESSIONS = 8

/** A player is sub-out eligible on pace grounds once possessionsPlayed / possessionsElapsed
 *  exceeds their target share (rotationMinutes / REGULATION_MINUTES) by this fraction. */
export const PACE_OVERAGE_THRESHOLD = 0.2

/** Weight on a bench candidate's raw-attribute quality in rotationValue. */
export const ROTATION_QUALITY_WEIGHT = 0.6

/** Weight on how well a bench candidate matches up against whichever opposing player occupies
 *  the same position, in rotationValue. */
export const ROTATION_MATCHUP_WEIGHT = 0.4

// --- Development System (DP / Training Focus) ---

/** Base DP for a rising-stage player at the oldest rising age (23). */
export const DP_RISING_BASE = 14
/** Extra base DP per year younger than 23 -- a 19-year-old earns DP_RISING_BASE + 4*this. */
export const DP_RISING_AGE_BONUS = 1.5
/** Flat base DP trickle for peak-stage players (ages 24-29). */
export const DP_PEAK_BASE = 4
/** Base DP at the youngest declining age (30) -- already negative. */
export const DP_DECLINE_BASE = -3
/** Extra negative base DP per year past 30. */
export const DP_DECLINE_AGE_PENALTY = 1.2
/** Base DP can never go below this, however old a player gets -- rosters age indefinitely
 *  (no retirement system yet), so this needs a hard floor rather than an unbounded decline. */
export const DP_DECLINE_FLOOR = -18

/** DP earned per total minutes played this season. */
export const DP_PER_SEASON_MINUTE = 0.03
/** Caps the playing-time bonus so it can't dwarf base/practice DP. */
export const DP_PLAYING_TIME_CAP = 20

/** DP bonus at individualDevelopmentShare = 100. */
export const DP_PRACTICE_BONUS_MAX = 6
/** Team-generation default for individualDevelopmentShare (0-100). */
export const DEFAULT_INDIVIDUAL_DEVELOPMENT_SHARE = 50

/** headCoachRating value at which the DP multiplier is exactly 1 -- midpoint of the 40-90
 *  generation range (see engine/generator/randomTeam.ts). */
export const COACHING_NEUTRAL_RATING = 65
/** Multiplier shift per rating point away from COACHING_NEUTRAL_RATING. */
export const COACHING_DP_FACTOR = 0.01
export const COACHING_MULT_MIN = 0.7
export const COACHING_MULT_MAX = 1.3

/** Fraction of a player's positive net DP split evenly across all 10 attributes regardless of
 *  Training Focus -- unfocused attributes still grow slowly, per the design doc. The remaining
 *  (1 - this) share is distributed by focus weight. */
export const UNFOCUSED_TRICKLE_SHARE = 0.15
/** Attribute points gained per DP-unit at full ease-out (gap >= EASE_OUT_REFERENCE_GAP). */
export const DP_TO_ATTRIBUTE_RATE = 0.06
/** Gap-to-potential (in attribute points) at/above which growth is untapered. */
export const EASE_OUT_REFERENCE_GAP = 20
/** Ease-out taper floor -- a 1-2 point gap still creeps forward, never fully stalls. */
export const EASE_OUT_MIN_FACTOR = 0.1

/** Decline eats attributes faster than growth adds them, per DP-unit of magnitude. */
export const DECAY_RATE_MULTIPLIER = 1.5

// --- Coaching Insights ---

/** A weak-link defender must be targeted at least this many times in a game before Coaching
 *  Insights calls it out -- mirrors the design doc's own "four times in the fourth" example. */
export const INSIGHT_WEAK_LINK_MIN_TARGETING_COUNT = 4

/** Caps how many fatigue-driven-substitution insights render per game, so a game with a lot of
 *  natural rotation churn doesn't drown the summary in near-duplicate observations. */
export const INSIGHT_MAX_FATIGUE_EVENTS = 3

// --- Synergy (Team.synergyScore -> offense strength multiplier, roguelite Section 8.3) ---

/** synergyScore at which the multiplier is exactly 1 -- matches the generator's baseline average
 *  roll and every other "neutral rating" constant here (COACHING_NEUTRAL_RATING, DURABILITY_NEUTRAL).
 *  Every AI-controlled team defaults here (see randomTeam.ts): only a roguelite run's user-controlled
 *  team ever deviates, via the drafted-system roster fit (run/variation/systemDraft.ts). */
export const SYNERGY_NEUTRAL = 65

/** Each synergyScore point above/below SYNERGY_NEUTRAL shifts the multiplier by 0.4%. */
export const SYNERGY_MULTIPLIER_FACTOR = 0.004
export const SYNERGY_MULTIPLIER_MIN = 0.9
export const SYNERGY_MULTIPLIER_MAX = 1.1
