import type { Position, TendencyProfile } from '../data/types'

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

/** Height band generation rolls within, per position -- also the fit reference for positionFit.ts's
 *  out-of-position height penalty (a player slotted outside their own band's range). */
export const POSITION_HEIGHT_RANGE_INCHES: Record<Position, [number, number]> = {
  PG: [72, 76],
  SG: [74, 78],
  SF: [77, 81],
  PF: [80, 84],
  C: [82, 88],
}

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

/**
 * Make probability for an evenly-matched two-point attempt, before the shot-quality margin moves it.
 * Realized two-point percentage lands ~54%, against a real league's ~53%.
 *
 * It could only be tuned to a real rate once offensive rebounds became retained possession. Before
 * that a trip was exactly one shot, so the engine took ~80 attempts per 100 possessions where a real
 * team takes ~89, and the per-attempt rate had to be inflated to ~59% to reach a believable score.
 * Second chances supply the missing attempts, so the percentage no longer has to lie to make up for
 * them.
 */
export const MAKE_PROB_BASE = 0.47

/**
 * How much less often a three goes in than a two of the same quality.
 *
 * Without this a three-point attempt was strictly better than a two: `isOutsideShotAction` changed
 * what the make was worth but not how hard it was, so the same ~50% conversion paid 3 points
 * instead of 2. Every jump-shooting playbook was therefore free money, and Seven Seconds Or Less
 * put up 152 a night at 61% from deep.
 *
 * 0.17 is the real gap -- the league shoots about 53% on twos and 36% on threes. The extra point is
 * what compensates for the difficulty, which is exactly the trade this constant restores.
 */
export const THREE_POINT_MAKE_PENALTY = 0.17
/** Attribute points of shot-quality margin per 1.0 of make probability. Raised from 200 to damp how
 *  hard a talent gap lands on the scoreboard: at 200 a mismatch swung scoring far enough to produce
 *  sub-90 and 160-point games several times more often than a real league does. Still the main way
 *  roster quality reaches the score -- just no longer the only thing that matters. Tuned alongside
 *  the pace and shot constants to keep the spread of team scores near a real league's. */
export const MAKE_PROB_MARGIN_SCALE = 360
/** Floor on a single attempt. Raised from 0.05, which let a badly outmatched offense shoot 5% and
 *  produced sub-90 team scores in ~10% of games against a real ~2%. Even a heavily contested shot by
 *  a poor scorer falls somewhere near a quarter of the time; nobody shoots 5%. */
export const MAKE_PROB_MIN = 0.25
export const MAKE_PROB_MAX = 0.85

/** Tuned to land around 22 free-throw attempts a team a game, the real rate. At the old 0.12 the
 *  engine produced ~18, which cost roughly four points a side once free throws started scoring. */
export const FOUL_PROB_BASE = 0.15
export const FOUL_PROB_INTERIOR_BONUS = 0.08

/**
 * Free throws from a shooting foul. There is no dedicated Free Throw attribute, so Outside Shot
 * stands in as shooting touch -- the same rating that drives jumpers, which is what a free throw is
 * with nobody guarding it.
 *
 * The band is deliberately narrow and high: real NBA free-throw percentage runs roughly 55% (a poor
 * big) to 90% (an elite guard), a far tighter spread than field-goal percentage, because the shot is
 * uncontested. Mapping the 0-100 attribute scale across that range keeps a 45-outside-shot center
 * genuinely bad at the line without making him hopeless.
 */
export const FREE_THROW_PROB_MIN = 0.55
export const FREE_THROW_PROB_MAX = 0.9

/** Free throws awarded by a shooting foul, matching the real rules: three if the foul came on a
 *  three-point attempt, two otherwise. There's no and-1 -- the engine only rolls a foul after the
 *  shot has already missed (see outcomeResolver), so a make and a foul never coincide. */
export const FREE_THROWS_ON_TWO = 2
export const FREE_THROWS_ON_THREE = 3

export const CONSISTENCY_NOISE_MAX = 12
export const CLUTCH_BONUS_MAX = 6
/** Seconds left in the final period inside which a close game counts as clutch -- the NBA's own
 *  definition. Replaces a "last 5% of the possessions" approximation that, with regulation running
 *  as one undivided block, worked out to roughly the last five possessions of the game. */
export const CLUTCH_SECONDS_REMAINING = 300
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

// --- Game clock ---

/** Standard game length in minutes. */
export const REGULATION_MINUTES = 48

/** Real-NBA overtime length: 5 minutes per extra period. */
export const OVERTIME_MINUTES = 5

export const SECONDS_PER_MINUTE = 60
export const REGULATION_PERIODS = 4
/** 12-minute quarters. */
export const PERIOD_SECONDS = (REGULATION_MINUTES / REGULATION_PERIODS) * SECONDS_PER_MINUTE
export const REGULATION_SECONDS = REGULATION_MINUTES * SECONDS_PER_MINUTE
export const OVERTIME_SECONDS = OVERTIME_MINUTES * SECONDS_PER_MINUTE

/**
 * How long each play call takes off the clock, in seconds, before pace scaling. Transition is a
 * sprint; half-court sets take a normal trip; isolation and post-ups grind the shot clock down.
 * Every band sits under the 24-second shot clock, which the old possession-counted model could not
 * honour -- 100 possessions across 48 minutes implied 28.8 seconds each.
 */
export const POSSESSION_DURATION_BANDS: Record<string, readonly [number, number]> = {
  transition: [9, 14],
  'pick-and-roll': [13, 18],
  cutting: [13, 18],
  'spot-up': [13, 18],
  isolation: [15, 20],
  'post-up': [15, 20],
}

/**
 * The reference possession length `paceScale` normalizes against, so a league configured for N
 * possessions actually gets about N under a neutral playbook.
 *
 * This is the *realized* mean of the unscaled model, not the unweighted mean of
 * POSSESSION_DURATION_BANDS' midpoints -- it sits above that because the outcome adjustments are
 * asymmetric: roughly 40% of possessions are misses paying REBOUND_SECONDS while only ~10% are
 * turnovers getting the truncation.
 *
 * Calibrated against a randomly generated league rather than any single playbook, since the mix of
 * systems across eight teams is what a player actually sees. That lands the league at ~98 true
 * possessions a team, the real rate. Note "possession" here means a trip: an offensive rebound
 * keeps the ball, so a team runs ~108 logged attempts against those ~98 trips.
 *
 * Playbooks that skew fast or slow still move off that number in the right direction, which is the
 * whole point of deriving pace from play calls rather than fixing it -- just not by the ~44% spread
 * the first pass produced, against a real league's ~7%.
 */
export const NOMINAL_POSSESSION_SECONDS = 16.6

/** A live-ball turnover happens partway through the action, not at the end of it. */
export const TURNOVER_DURATION_FACTOR = 0.65

/** The rebound scramble after a missed shot, before the other team has the ball. Makes and fouls
 *  don't pay it: a make is inbounded and a foul stops the clock outright. */
export const REBOUND_SECONDS = 2.5

/** A putback off an offensive rebound is a shot already in progress, not a fresh trip up the floor,
 *  so it costs a few seconds rather than a full possession's worth. */
export const SECOND_CHANCE_DURATION_BAND: readonly [number, number] = [3, 7]

// --- Rebounding ---

/**
 * Share of missed shots the shooting team recovers when both fives rebound equally -- the real
 * league runs 23-28%. An offensive rebound keeps the ball with the offense rather than merely
 * crediting a stat, so this is what produces second-chance shots: a trip can now span several
 * attempts, which is where the ~89 field-goal attempts per 100 possessions a real team takes
 * actually come from.
 */
export const OFFENSIVE_REBOUND_RATE = 0.25

/** Attribute points of team rebounding edge per 1.0 of offensive-rebound probability. A five
 *  averaging 10 points more Rebounding than the opponent pulls roughly 4% more of its own misses,
 *  which is about the real spread between the best and worst rebounding teams. */
export const OFFENSIVE_REBOUND_SENSITIVITY = 250

// --- Bench rotation / fatigue ---

/** Relative target-minutes share by depth-chart rank within a position group (0 = starter),
 *  normalized to sum to REGULATION_MINUTES across however many players occupy that group. */
export const ROTATION_DEPTH_WEIGHTS = [1.0, 0.5, 0.2, 0.1, 0.05]

/**
 * Fatigue points gained per SECOND on the floor, at DURABILITY_NEUTRAL. Denominated in seconds
 * rather than possessions now that the clock is real -- a possession is no longer a fixed slice of
 * the game, so per-possession rates would silently change every shift length whenever pace moved.
 *
 * Carried over from the old tuning rather than re-picked: 18 possessions x 4.5 = 81 fatigue over
 * 8.64 minutes (518s) at the old 100-possession pace, so 81 / 518 ~= 0.156/s. A continuously-playing
 * average-durability player still hits FATIGUE_SUB_OUT_THRESHOLD after roughly 8.5 minutes.
 */
export const FATIGUE_GAIN_PER_SECOND = 0.156

/** Fatigue recovered per SECOND benched, at DURABILITY_NEUTRAL. Same carry-over: 10 possessions x
 *  5.0 = 50 points over 4.8 minutes (288s) gives 50 / 288 ~= 0.174/s, so a maxed-out player still
 *  drops under FATIGUE_SUB_IN_MAX after about five minutes of rest. */
export const FATIGUE_RECOVERY_PER_SECOND = 0.174

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

/** Fatigue so high a player is pulled immediately, bypassing MIN_SHIFT_SECONDS's cooldown. */
export const FATIGUE_EMERGENCY_THRESHOLD = 95

/** A bench player must be rested to at or below this to be sub-in eligible -- left well below
 *  FATIGUE_SUB_OUT_THRESHOLD so a just-subbed-out player can never immediately re-qualify. */
export const FATIGUE_SUB_IN_MAX = 30

/** Seconds a player must stay on court after entering before being re-evaluated for a sub-out
 *  (except via FATIGUE_EMERGENCY_THRESHOLD) -- prevents rapid in/out thrashing when fatigue or pace
 *  sits right at a threshold boundary. ~3 minutes, carried over from the old 6-possession cooldown
 *  (6/100 of a 48-minute game = 2.88 minutes). */
export const MIN_SHIFT_SECONDS = 175

/** Game seconds elapsed below which the pace-overage trigger is skipped entirely -- avoids dividing
 *  by a tiny elapsed time in the opening minutes. Carried over from the old 8-possession guard. */
export const PACE_CHECK_MIN_SECONDS = 230

/** A player is sub-out eligible on pace grounds once secondsPlayed / secondsElapsed exceeds their
 *  target share (rotationMinutes / REGULATION_MINUTES) by this fraction. */
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

// --- Positional versatility (rotation-charts.md Phase E) ---

/**
 * Attribute points docked, at full demand weight, per slot of distance between a player's own
 * position and the slot they're charted into (PG->SG is 1, PG->C is 4). "Full demand weight" means
 * the attribute the slot leans on hardest -- see SLOT_INTERIOR_LEAN. A first-cut number, not yet
 * tuned against real lineups (rotation-charts.md Section 8): a max four-slot slide docks the
 * hardest-leaned-on attributes by 4x this before the height term.
 */
export const POSITION_FIT_SLIDE_PENALTY_PER_SLOT = 6

/** Extra points docked per inch a player's height sits outside the charted slot's own band
 *  (POSITION_HEIGHT_RANGE_INCHES) -- on top of, not instead of, the slide penalty, since a slide can
 *  be short in slot-count but still a bad height match (a 6'3" PG slid one slot to SF, say). */
export const POSITION_FIT_HEIGHT_PENALTY_PER_INCH = 3

/**
 * How far each slot leans toward interior attributes (insideShot, rebounding, interiorDefense,
 * vertical) versus perimeter ones (outsideShot, passing, ballHandling, perimeterDefense, speed,
 * lateralQuickness), 0 (fully perimeter) to 1 (fully interior). Interpolated across POSITION_ORDER
 * rather than a hand-authored table per slot -- PG/C are the anchors and SG/SF/PF fall in a straight
 * line between them, which lands SF at an even 0.5, matching its already-neutral POSITION_BIAS entry
 * in randomPlayer.ts. A slot's demand weight for a given attribute is this lean (interior attributes)
 * or its complement (perimeter attributes), and the dock for that attribute is the slide/height
 * severity times its demand weight -- which is what makes a PG slid to C lose rebounding and interior
 * defense while keeping his passing untouched (rotation-charts.md Section 4).
 */
export const SLOT_INTERIOR_LEAN: Record<Position, number> = {
  PG: 0,
  SG: 0.25,
  SF: 0.5,
  PF: 0.75,
  C: 1,
}

/** A player's height counts as "in range" for a position if it falls in that position's own
 *  POSITION_HEIGHT_RANGE_INCHES band. Positionless requires the height to land in at least this
 *  many bands at once (there is real overlap at the edges -- see rotation-charts.md Section 3's
 *  6'9"-SF example, which is in-range for both SF and PF). */
export const POSITIONLESS_MIN_HEIGHT_BANDS = 2

/** Spread (max attribute - min attribute) at/below which a profile counts as "balanced" for
 *  Positionless, and at/above which it counts as "spiked" for Specialist. Attributes run 0-100, so
 *  this is a generous band on each side of "roughly flat". */
export const POSITIONLESS_ATTRIBUTE_SPREAD_MAX = 35
export const SPECIALIST_ATTRIBUTE_SPREAD_MIN = 55

/** A height within this many inches of either edge of the player's own position's band counts as
 *  "at the extreme" for Specialist -- the tall end of PG or the short end of C, say. */
export const SPECIALIST_HEIGHT_EDGE_INCHES = 1

/** Multiplies the slide/height severity before it's applied: a Positionless player's height and
 *  attribute profile already fit more than one slot, so a slide costs them less; a Specialist is
 *  built for exactly one slot, so leaving it costs them more. Neither is stored -- both are derived
 *  fresh from height and attributes every time (rotation-charts.md Section 4, "derive, don't store"). */
export const POSITIONLESS_SEVERITY_MULTIPLIER = 0.5
export const SPECIALIST_SEVERITY_MULTIPLIER = 1.5
