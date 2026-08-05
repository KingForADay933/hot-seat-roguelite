/** Run-wrapper tuning. Distinct from engine/constants.ts (simulation balance) -- these govern the
 *  roguelite structure itself: how long a season is, how many chances you get, how fast the bar rises. */

/** Games per season within a run. Shortened from Hoop Sim's 82-game default so a season simulates
 *  and reads (commentary/insights) in the doc's ~5-10 minute session target. */
export const RUN_SEASON_LENGTH = 32

/** Teams in a run's league. Must be even (generateSchedule's round-robin requirement). */
export const RUN_TEAM_COUNT = 8

/** First stretch's target: finish in the top half of standings. */
export const STARTING_TARGET_RANK_FRACTION = 0.5

/** Each successful stretch tightens the target by this many percentage points. */
export const TARGET_RANK_FRACTION_STEP = 0.1

/** Target can never demand better than top-10% -- keeps late stretches hard but not literally
 *  "finish 1st or fired." */
export const MIN_TARGET_RANK_FRACTION = 0.1

/** Candidates rolled for the run-start roster-quirk and house-rule drafts -- picked from a
 *  tighter hand than the system draft, since these are framed as constraints, not a build choice. */
export const QUIRK_DRAFT_SIZE = 2
export const HOUSE_RULE_DRAFT_SIZE = 2

// --- Market size (Section 8.1) -- imposed, not drafted, at run start ---
// Two distinct axes per tier: cash (budgetMultiplier) vs. patience (seasonsPerStretch), so no tier
// is strictly better than another. Wired into marketSize.ts's MARKET_SIZES table.

export const MARKET_BUDGET_MULTIPLIER_BIG = 1.5
export const MARKET_BUDGET_MULTIPLIER_MID = 1.0
export const MARKET_BUDGET_MULTIPLIER_SMALL = 0.6

export const SEASONS_PER_STRETCH_BIG = 2
export const SEASONS_PER_STRETCH_MID = 3
export const SEASONS_PER_STRETCH_SMALL = 4

// --- Budget economy (Section 8.4) -- first-pass numbers, needs playtesting to tune ---

/** Budget earned per regular-season win, before the market multiplier. */
export const BUDGET_PER_WIN = 10

/** Flat budget bonus on top of the per-win earnings when a season clears the run's target,
 *  before the market multiplier -- ties the economy to the escalation system, not just wins. */
export const STRETCH_CLEAR_BUDGET_BONUS = 150
