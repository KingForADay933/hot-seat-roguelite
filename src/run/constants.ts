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

/** Wider hand for the system draft -- framed as a real build choice, not a constraint. */
export const SYSTEM_DRAFT_SIZE = 3

/** A season is split into this many checkpoints (Section 9) -- 32 games / 4 = an even split,
 *  landing checkpoints after games 8/16/24 plus the real season end after 32. Each checkpoint
 *  (except the season-ending one) surfaces that stretch's Coaching Insights and lets the GM nudge
 *  rotation minutes / training focus in response before the next chunk plays. */
export const SEASON_CHUNK_COUNT = 4

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

// --- Shop (Section 8.4) & Camps (Section 8.5), Phase 7 -- first-pass numbers, needs playtesting to tune ---
// The condensed tier runs every season; a stretch-clear season instead opens the pricier, wider
// expanded tier. Both grant "purchase power" -- a count of camp buys the GM can spend on any
// roster player, and any attribute, of their choosing (run/shop/shopVisit.ts's openShopVisit) --
// reworked from an earlier pre-rolled-offer-list design after playtesting found "hope it rolled
// the player/attribute you needed" too restrictive. Coaching upgrades (Phase 8) and consumables
// (Phase 9) aren't built yet -- those will stay randomly rolled from a content pool, which is what
// a reroll option will matter for once they exist; camps have nothing left to reroll now that
// player/attribute choice is free.

/** Player-camp purchases grantable in the every-season condensed tier. */
export const SHOP_CONDENSED_PLAYER_CAMPS = 2

/** Player-camp purchases grantable in the stretch-clear expanded tier, plus SHOP_EXPANDED_TEAM_CAMPS team-camp purchases. */
export const SHOP_EXPANDED_PLAYER_CAMPS = 3
export const SHOP_EXPANDED_TEAM_CAMPS = 1

/** Cost of sending one player to camp. */
export const PLAYER_CAMP_COST = 60
/** Cost of sending the whole roster to camp -- pricier than stacking individual player camps
 *  would be, offset by the per-player boost being smaller (see TEAM_CAMP_ATTRIBUTE_SHIFT_*
 *  below) so it's a breadth-vs-depth choice, not a strictly better buy. */
export const TEAM_CAMP_COST = 350

/** Bounded random magnitude for the single, GM-chosen attribute a player-camp purchase boosts --
 *  same shift range as Tier 3's wildcard breakout (run/variation/wildcardEvents.ts's
 *  BREAKOUT_SHIFT), chosen and paid for instead of random and free, but concentrated on one
 *  attribute rather than spread across all of them. */
export const CAMP_ATTRIBUTE_SHIFT_MIN = 3
export const CAMP_ATTRIBUTE_SHIFT_MAX = 6

/** Per-player boost for a team camp -- capped lower than a single-player camp's since it lands
 *  on the whole roster at once. */
export const TEAM_CAMP_ATTRIBUTE_SHIFT_MIN = 2
export const TEAM_CAMP_ATTRIBUTE_SHIFT_MAX = 4
