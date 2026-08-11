import type { AttributeKey, PlayCallType, Position, TendencyProfile } from '../data/types'

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

/**
 * Talent, which the generator did not previously have in any form.
 *
 * Every attribute used to be rolled independently, so `overallRating` -- the mean of ten of them --
 * had its spread crushed by the central limit theorem to a standard deviation of **3.53** on a
 * 0-100 scale. Measured over 400 leagues, that produced a league averaging 71.5 in which only 0.30%
 * of players reached 82 and *nobody ever reached 90*. Since run/assignWorstTeam.ts hands the GM the
 * league's worst roster on purpose, the roster actually played had 77.3% of its starters under 75
 * and no 82+ player 99.2% of the time -- a lost cause by the 2K standard this was retuned against.
 *
 * The same gap explained the depth chart. With no talent structure, which player was best at a
 * position was pure noise, so a doubled-up position benched its second-best above some other
 * position's starter on **86.8%** of teams.
 *
 * Both are fixed by one thing: a per-player offset applied to all ten attributes at once, so overall
 * is mostly *talent* with noise around it rather than noise alone. It is composed into the `shift`
 * argument generatePlayer already accepts for the league-wide "Average Overall" slider.
 */

/**
 * Additive talent by depth-chart rung, best to worst across a 12-man roster.
 *
 * A ladder rather than a symmetric draw because a normal distribution has no star tail -- the top
 * rung is what puts a franchise player on most rosters. randomTeam.ts assigns rungs 0-4 to five
 * *distinct* positions, which is what makes the existing "best overall at each position" starter
 * selection pick the five best players without that logic changing at all.
 */
export const ROSTER_TALENT_LADDER = [8, 4, 2, 1, 1, -9, -9, -10, -10, -11, -11, -12] as const

/** Random wobble around a player's rung. Keeps the ladder from reading as visible tiers, and is what
 *  leaves a sixth man occasionally a point or two above the weakest starter -- real rosters have good
 *  bench players, and a perfectly ordered depth chart reads artificial. */
export const TALENT_JITTER = 1.5

/** Half-width of the per-team talent draw, so the league has contenders and cellar-dwellers rather
 *  than eight interchangeable rosters. pickWorstTeamId needs this to mean anything. */
export const TEAM_TALENT_SPREAD = 6

/** Flat lift on every generated player, which is what raises the league off its old 71.5 mean. Tuned
 *  against the ladder's own average so the two together land the league where it should sit. */
export const TALENT_BASELINE = 7.5

/** Height band generation rolls within, per position -- also the fit reference for positionFit.ts's
 *  out-of-position height penalty (a player slotted outside their own band's range). */
export const POSITION_HEIGHT_RANGE_INCHES: Record<Position, [number, number]> = {
  PG: [72, 76],
  SG: [74, 78],
  SF: [77, 81],
  PF: [80, 84],
  C: [82, 88],
}

/**
 * Position-flavored attribute bias, in points, applied on top of a bell-ish baseline roll
 * (engine/generator/randomPlayer.ts).
 *
 * Lives here rather than privately in the generator because it has a second, non-obvious reader:
 * engine/positionFit.ts measures how *spiked* a player's profile is, and the honest version of that
 * question subtracts what his position is rolled with first. A PG comes out of the generator +15
 * ballHandling and -15 rebounding, so 30 points of spread are baked in before any dice -- measuring
 * raw max-minus-min was really asking "is this PG shaped like a PG", which every PG is.
 *
 * Same arrangement, and the same reason, as POSITION_HEIGHT_RANGE_INCHES above: one table, two
 * readers, no chance of the two drifting apart.
 */
export const POSITION_BIAS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  PG: {
    ballHandling: 15,
    passing: 15,
    speed: 10,
    lateralQuickness: 10,
    outsideShot: 5,
    insideShot: -10,
    interiorDefense: -15,
    rebounding: -15,
  },
  SG: {
    outsideShot: 15,
    ballHandling: 5,
    speed: 5,
    perimeterDefense: 5,
    interiorDefense: -10,
    rebounding: -10,
  },
  SF: {},
  PF: {
    insideShot: 10,
    rebounding: 10,
    interiorDefense: 10,
    vertical: 5,
    outsideShot: -10,
    ballHandling: -10,
    speed: -5,
  },
  C: {
    insideShot: 15,
    rebounding: 15,
    interiorDefense: 15,
    vertical: 10,
    outsideShot: -15,
    ballHandling: -15,
    speed: -10,
    lateralQuickness: -10,
    passing: -5,
  },
}

/**
 * Each play call's offense strength, as a weighted blend of the attributes that actually decide it.
 *
 * Two of these used to describe something other than scoring, which is why cuts and fast breaks were
 * the engine's *worst* play calls when they are two of basketball's best:
 *
 *  - Transition blended the on-court five's mean `rebounding` at 0.3. Rebounding is not a finishing
 *    skill, and averaging it across the floor dragged every guard-led break toward the roster's
 *    bigs. A runout ends at the rim, so the term is `insideShot` on the player finishing it.
 *  - Cutting had no finishing attribute at all -- `speed` and mean `passing`, nothing else. A
 *    backdoor cut ends in a layup; `insideShot` belongs in it for the same reason.
 *
 * A hand-maintained mirror of these formulas lives in run/variation/possessionRoles.ts, used to
 * score system fit before a game is played. Change one and change the other -- possessionRoles.test.ts
 * fails if they disagree.
 */
export const POSSESSION_STRENGTH_WEIGHTS = {
  pickAndRoll: { handlerBallHandling: 0.35, handlerPassing: 0.25, rollerInsideShot: 0.25, rollerVertical: 0.15 },
  isolation: { ballHandling: 0.4, shot: 0.35, shotSelection: 0.25 },
  postUp: { insideShot: 0.6, vertical: 0.4 },
  spotUp: { outsideShot: 0.55, creatorPassing: 0.45 },
  cutting: { speed: 0.3, insideShot: 0.35, passingAvg: 0.35 },
  transition: { speed: 0.4, passing: 0.25, insideShot: 0.35 },
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

// --- Defensive attribution: which turnovers are steals, which misses are blocked ---
// Neither changes what happens in a possession -- a stolen turnover is still a turnover and a
// blocked shot is still a miss, with the same points and the same rebound. They decide only whether
// a *defender* gets credit, which is the difference between a defensive build being something you
// can see working and something you have to take on faith.

/**
 * Share of turnovers that are live-ball steals rather than unforced errors, at neutral pressure.
 * Real leagues run a bit over half; the rest are travels, offensive fouls and passes into the crowd,
 * which have no defender to credit.
 *
 * Measured over 160 games: 56% of turnovers credited, 5.8 steals a team a game. Real is nearer 7.5,
 * and the gap is inherited rather than introduced here -- the engine's turnover rate itself sits at
 * ~10.4 a team against a real ~13.5, so the share is right and the base it applies to is light. Fix
 * that in TURNOVER_BASE_PROB if it's worth fixing; raising this instead would only paper over it by
 * crediting an unrealistic fraction of giveaways as strips.
 */
export const STEAL_SHARE_BASE = 0.55

/**
 * How far the steal share swings with the defender's pressure advantage over the ball-handler, on
 * the same (defence - handling) scale TURNOVER_SENSITIVITY uses. A stifling defender doesn't just
 * force more turnovers -- more of the ones they force are strips rather than fumbles.
 */
export const STEAL_SHARE_SENSITIVITY = 200
export const STEAL_SHARE_MIN = 0.3
export const STEAL_SHARE_MAX = 0.8

/**
 * Share of missed *interior* attempts that are blocked, at neutral rim protection. Blocks are
 * overwhelmingly a paint event, so outside misses use the far lower rate below.
 *
 * Sized against the real rate of roughly one block per twenty field-goal attempts: only misses are
 * eligible here (a blocked shot never counts as made), and interior attempts are a subset of those,
 * so the per-eligible-miss rate has to sit well above the per-attempt rate to land there.
 *
 * Measured over 160 games: 4.3 blocks a team a game at 4.9% of attempts, against a real ~5 and ~5%.
 */
export const BLOCK_SHARE_INTERIOR = 0.14
export const BLOCK_SHARE_OUTSIDE = 0.02

/**
 * How far the block share swings with the defender's rim protection relative to a neutral defender,
 * measured on the interior-defence/vertical average positionFit already treats as the interior pair.
 */
export const BLOCK_SHARE_SENSITIVITY = 300
export const BLOCK_SHARE_MIN = 0.01
export const BLOCK_SHARE_MAX = 0.35

/**
 * Make probability for an evenly-matched attempt, before the shot-quality margin moves it -- per
 * play call, because a layup off a cut and a contested isolation jumper are not the same shot.
 *
 * This was a single 0.47 for every attempt in the engine, which meant a play call could only be
 * better than another by producing better *players* on the possession, never by producing a better
 * *shot*. That is the wrong model of basketball and it showed: measured across 240 games, cutting
 * and transition -- the two most efficient things a real offense does -- came out fifth and sixth
 * of six, and spot-up came out first. The tactical shot-selection dial sat on top of that ordering,
 * so Hunt Threes won for every system tested and the dial was a setting rather than a decision.
 *
 * The values encode shot location. Cuts and fast breaks finish at the rim and convert far better
 * than a jumper; post-ups and isolations are the grinding half-court looks a defense is happy to
 * concede. THREE_POINT_MAKE_PENALTY is still subtracted on top for outside attempts, so spot-up's
 * number is a two-point-equivalent baseline, not its realized rate (it lands ~37% from deep).
 *
 * Tuned as a set, against measured points per play, holding total scoring where scoringCalibration
 * wants it -- the level is set by the weighted average, the spread by real basketball. Measured over
 * 240 games at these values, against the same 240 before the change:
 *
 *   cutting       1.000 -> 1.181     pick-and-roll  1.062 -> 1.020
 *   transition    0.917 -> 1.143     post-up        1.036 -> 1.000
 *   spot-up       1.102 -> 1.068     isolation      1.026 -> 0.978
 *
 * at 222.0 combined points against 221.2 -- the ordering inverted, the scoring level untouched.
 * Realized rim rates land at 65% on cuts and 63% in transition against a real league's ~65% at the
 * basket, and spot-up at 35% from three against ~36%.
 */
export const MAKE_PROB_BASE_BY_PLAY_CALL: Record<PlayCallType, number> = {
  cutting: 0.582,
  transition: 0.595,
  'spot-up': 0.437,
  'pick-and-roll': 0.453,
  'post-up': 0.449,
  isolation: 0.441,
}

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
/** The period after which the long break falls -- derived rather than written as 2, so a rules
 *  variant with a different period count keeps its halftime in the middle. */
export const HALFTIME_AFTER_PERIOD = REGULATION_PERIODS / 2
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

/**
 * How sharply the best rebounder on the floor out-competes the worst for a loose ball.
 *
 * Starts equal to USAGE_WEIGHT_EXPONENT and means the same thing on the other end of the court: a
 * contest resolved by weighted pick, where an exponent of 1 spreads the ball evenly across everyone
 * with a pulse and a high exponent hands it to the best fit every time. Boards were previously
 * picked with no exponent at all, which is why a 55-rated guard came down with 73% as many as a
 * 75-rated centre.
 *
 * Named separately rather than importing USAGE_WEIGHT_EXPONENT directly so the two can diverge when
 * one of them needs tuning -- they start equal because there is no evidence yet that rebounding
 * concentrates differently from shot creation, not because they must move together.
 */
export const REBOUND_WEIGHT_EXPONENT = USAGE_WEIGHT_EXPONENT

/**
 * How much of a player's rebounding contest score comes from *size* rather than from the Rebounding
 * attribute itself, 0-1.
 *
 * Rebounding alone left a 6'0" point guard and a 7'0" centre competing on near-equal terms whenever
 * their Rebounding ratings were close, which reads as wrong however the rest is tuned. Size is taken
 * as Interior Defense + Vertical (engine/matchup.ts's avgInteriorDefense) -- the composite the engine
 * already uses to mean "big", so this introduces no new notion of size and no dependency on
 * heightInches, which the simulation otherwise never reads.
 */
export const REBOUND_SIZE_WEIGHT = 0.4

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

/**
 * Fatigue at which a coach starts *looking* for a rest, rather than needing one.
 *
 * The heuristic used to have no trigger between "fine" and FATIGUE_SUB_OUT_THRESHOLD's 80, so a
 * player only came off when either their minutes ran ahead of target or they were genuinely
 * labouring -- and measurement showed 28.7% of all substitutions happening at 80 or above. A real
 * rotation does not run its starters to the line and then react; it rests them while it can still
 * afford to.
 *
 * Chosen by sweep: 45 and 60 both leave more players reaching 80 than 55 does (10.2% and 11.3%
 * against 9.9% at the time of measurement), 45 by churning through shifts too fast to keep anyone
 * fresh and 60 by simply waiting too long. It only ever becomes a substitution when a rested
 * replacement exists at the slot, so it shortens shifts without stranding a thin position group.
 */
export const FATIGUE_ROTATE_THRESHOLD = 55

/** Fatigue so high a player is pulled immediately, bypassing MIN_SHIFT_SECONDS's cooldown. */
export const FATIGUE_EMERGENCY_THRESHOLD = 95

/**
 * Fatigue points handed back at a break in play, before the durability multiplier. Everyone gets
 * them, on court or not -- the whole point is that a break is time nobody spends playing, which is
 * the one thing the per-second model above cannot express.
 *
 * Flat rather than a share of what a player has accumulated: a break is a fixed span of sitting
 * down, and how much good it does should not depend on how tired you happened to be when it started.
 *
 * Denominated in points rather than in "seconds of bench rest", even though the two are the same
 * thing through FATIGUE_RECOVERY_PER_SECOND. Seconds would invite writing down the real fifteen-
 * minute halftime, which at 0.174/s restores 156 points against a 100-point scale and would reset
 * every player to zero every game. Points state the intent directly instead of passing a fudged
 * number and hoping nobody reads it as wall clock.
 *
 * 35 undoes roughly 3.7 minutes of play; 12 undoes about 80 seconds. A player who never leaves the
 * floor still gets only 59 back across a whole game and still runs out -- nobody plays 48 minutes
 * fresh -- but it now happens in the fourth quarter rather than the middle of the second.
 */
export const FATIGUE_HALFTIME_RECOVERY = 35
export const FATIGUE_PERIOD_BREAK_RECOVERY = 12

/**
 * The band over which fatigue starts costing a player something on the floor: nothing at or below
 * the threshold, the full penalty at or above the ceiling, linear between.
 *
 * **Both numbers are calibrated to the fatigue that actually occurs, not to the 0-100 scale**, and
 * that distinction is the whole reason they are not 50 and 100. Measured across 30 games and 32,075
 * player-possessions, on-court fatigue runs: median 24.4, p75 35.4, p90 45.5, p99 56.2, **max 65.3**.
 * Nobody is ever gassed, because the rotation is specifically built to prevent it -- substitutions
 * trigger at FATIGUE_ROTATE_THRESHOLD's 55, and the period breaks hand everyone points back on top.
 *
 * So the 0-100 scale is nominal and the lived range is roughly 0-65. A penalty ramping to full at
 * 100 would have reached about a third of its strength at the tiredest moment any player reached all
 * season, and one starting at 70 would never have fired at all. 35 to 65 puts the median player at
 * no penalty, the p75 player just starting to feel it, and the rare p99 player near the full cost.
 */
export const FATIGUE_PENALTY_THRESHOLD = 35
export const FATIGUE_PENALTY_FULL_AT = 65

/** Attribute points docked at the full penalty, before the per-attribute weighting below. */
export const FATIGUE_ATTRIBUTE_PENALTY_MAX = 16

/**
 * Consistency points docked at the full penalty -- the variance half of the effect.
 *
 * Costs nothing to wire: possession/variance.ts's computeConsistencyNoise already sets its standard
 * deviation from `(100 - consistency) / 100 * CONSISTENCY_NOISE_MAX`, so lowering a tired player's
 * consistency on the same transient copy widens his night-to-night swing with no new parameter
 * anywhere. Against a generated range of roughly 40-90, 15 points is a real widening without turning
 * a tired player into a coin flip.
 */
export const FATIGUE_CONSISTENCY_PENALTY_MAX = 15

/**
 * How much of the dock each attribute takes -- what goes first when a player tires is the jump shot
 * and the first step, not his hands or his sense of where a rebound is going.
 *
 * Weighted rather than flat because this is what makes a late-game lineup a decision: shooters fade
 * and bigs endure, so who closes a game is a choice rather than "play the best five". It is also
 * what gives Durability, the Iron Man Program and the Gasses Out tag a meaning on the floor instead
 * of only in a substitution log.
 */
export const FATIGUE_ATTRIBUTE_WEIGHTS: Record<AttributeKey, number> = {
  outsideShot: 1,
  speed: 1,
  lateralQuickness: 1,
  vertical: 1,
  insideShot: 0.6,
  perimeterDefense: 0.6,
  interiorDefense: 0.4,
  rebounding: 0.3,
  ballHandling: 0.3,
  passing: 0.2,
}

/** A bench player must be rested to at or below this to be sub-in eligible -- left well below
 *  FATIGUE_SUB_OUT_THRESHOLD so a just-subbed-out player can never immediately re-qualify. */
export const FATIGUE_SUB_IN_MAX = 30

/**
 * Seconds a player must stay on court after entering before being re-evaluated for a sub-out
 * (except via FATIGUE_EMERGENCY_THRESHOLD) -- prevents rapid in/out thrashing when fatigue or pace
 * sits right at a threshold boundary.
 *
 * Raised from 175 (~2.9 minutes, itself carried over from an old 6-possession cooldown) once
 * FATIGUE_ROTATE_THRESHOLD started pulling players earlier: shorter shifts plus an earlier trigger
 * churned the rotation, 65 substitutions a team-game against a real dozen or so. At 240 the same
 * zero-players-run-into-the-ground result comes with 51.6 a game and stints averaging about 4.6
 * minutes rather than 3.7. 300 churns less still (42.7) but starts letting players back over 80,
 * which is the thing this was fixing.
 */
export const MIN_SHIFT_SECONDS = 240

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

/** Spread at/below which a profile counts as "balanced" for Positionless, and at/above which it
 *  counts as "spiked" for Specialist. Both read positionFit.ts's `positionRelativeSpread`, not the
 *  raw max-minus-min: POSITION_BIAS above builds 30 points of raw spread into a point guard before
 *  a die is thrown, so a raw test mostly asks "is this PG shaped like a PG".
 *
 *  Derived from the residual distribution across generated leagues, sized to put roughly the flattest
 *  fifth and the spikiest fifth on either side and leave neutral the clear plurality everywhere --
 *  see positionFit.test.ts's distribution test, which is the real specification.
 *
 *  Positionless dropped 26 -> 24 when ROSTER_TALENT_LADDER landed. Raising the league's ratings
 *  compresses residual spread from the top: a star whose best attributes clamp against
 *  ATTRIBUTE_CEILING has a flatter *measured* profile than the same player twenty points lower, and
 *  at 26 that pushed Positionless to 31% at some positions -- past the point where the neutral case
 *  the out-of-position penalty was reasoned around is still the common one. Measured across 40
 *  leagues (3,840 players) the population median moved 32-34 -> 31, and the top decile sits at 28.
 *
 *  Some correlation between quality and Positionless survives at 24 and is left alone deliberately:
 *  a genuinely excellent player being able to line up anywhere is a fair reading, unlike the original
 *  bug this pair was retuned for, where the label was really just re-reading POSITION_BIAS. */
export const POSITIONLESS_ATTRIBUTE_SPREAD_MAX = 24
export const SPECIALIST_ATTRIBUTE_SPREAD_MIN = 42

/** Multiplies the slide/height severity before it's applied: a Positionless player's height and
 *  attribute profile already fit more than one slot, so a slide costs them less; a Specialist is
 *  built for exactly one slot, so leaving it costs them more. Neither is stored -- both are derived
 *  fresh from height and attributes every time (rotation-charts.md Section 4, "derive, don't store"). */
export const POSITIONLESS_SEVERITY_MULTIPLIER = 0.5
export const SPECIALIST_SEVERITY_MULTIPLIER = 1.5

/**
 * Tuning constants for the four tactical dials (data/types/team.ts's TacticalFocus). Read only
 * through engine/tacticalFocus.ts, which is the single place a dial turns into a number.
 *
 * Every one of these is an *offset* on a quantity computed elsewhere in this file, and every dial's
 * balanced setting applies none of them -- that is what keeps an un-focused team byte-identical to
 * the game before focus points existed.
 */

/** Scales a sampled possession duration. Pushing takes ~8% off the clock a trip burns, controlling
 *  adds ~8% -- worth roughly five possessions a game each way against a ~100-possession baseline,
 *  which is a real tempo swing without turning a half-court team into a track meet. */
export const FOCUS_PACE_DURATION_SCALE = 0.08

/**
 * The efficiency half of the pace trade, applied to the offense multiplier: rushed looks are worse
 * looks, and working the clock buys quality back.
 *
 * Small on purpose, and it was measured down to this. The volume half of the trade is *symmetric* --
 * a period is a fixed length and possessions alternate, so changing tempo hands the opponent exactly
 * as many extra trips as it hands you -- which means the two volume effects cancel between evenly
 * matched teams and what is left is whatever this constant does. At 0.02 that made Control Tempo a
 * flat, free +2% offense: measured across four systems and five opponent playbooks, it won every
 * single cell, which is the definition of a setting rather than a decision.
 *
 * What should decide the dial is the volume effect itself: more possessions amplify the gap between
 * two teams, so push when you are better and control when you are not. That is a real per-opponent
 * read, and it is exactly what the scouting report exists to inform.
 */
export const FOCUS_PACE_EFFICIENCY = 0.004

/** How hard shot selection leans the playbook. Applied multiplicatively (see tacticalFocus.ts), so
 *  the drafted system stays the identity -- a 40% lean on a play call the system never runs is still
 *  nothing, and a system with no transition cannot buy any. */
export const FOCUS_SHOT_SELECTION_LEAN = 0.4


/** Added to or taken off the defensive scheme's interiorFocus (0-1). resistance.ts's
 *  applyInteriorFocus is already symmetric around 0.5, so this gains inside exactly as much as it
 *  concedes outside; clamped in tacticalFocus.ts so a tilted Pack-the-Paint stays inside the range
 *  its formula was reasoned on. */
export const FOCUS_DEFENSIVE_TILT = 0.1

/** Added to or taken off the offensive rebound probability, against a 0.25 base -- a fifth of the
 *  rate either way, which shows up as a couple of extra second-chance possessions a game. */
export const FOCUS_GLASS_REBOUND_OFFSET = 0.04

/**
 * What the glass dial does to your *defense* on the possession right after your own missed shot --
 * the trip where whether you crashed or retreated decides if you are back in front of the ball.
 * Multiplies resistance: crashing concedes an unset defense, getting back arrives already set.
 *
 * This replaced a first attempt that granted the rebounding team extra transition weight instead,
 * on the reasoning that crashing concedes fast breaks. Measurement killed it: **transition is the
 * least efficient play call in the engine** (0.872 points per possession against spot-up's 1.134),
 * so handing the opponent more of it was a *gift* to the crasher rather than a cost. Crash then won
 * every cell of a four-system by five-opponent sweep by up to +6 points a game.
 *
 * Charging the cost as resistance instead is both correctly signed and truer to what a fast break
 * actually is: not a particular play call, but any play call against a defense that has not got
 * back. It also gives Get Back a real payout on the same quantity, so the dial is symmetric.
 */
export const FOCUS_GLASS_CRASH_RESISTANCE = 0.76
export const FOCUS_GLASS_GET_BACK_RESISTANCE = 1.14
