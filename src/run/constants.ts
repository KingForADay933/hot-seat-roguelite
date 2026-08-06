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
// expanded tier (run/shop/shopVisit.ts's openShopVisit picks which from lastSeasonTargetHit).
// A tier grants *purchase power* -- how many camp buys this visit -- not a pre-rolled, fixed
// player list: the GM freely picks who (any active roster player) and, for the boost itself,
// which attribute (see run/shop/campEffect.ts). Coaching upgrades (Phase 8) and consumables
// (Phase 9) aren't built yet.

/** Single-player camp purchases allowed on the every-season condensed tier. */
export const SHOP_CONDENSED_PLAYER_CAMP_LIMIT = 1

/** Single-player camp purchases allowed on the stretch-clear expanded tier, plus
 *  SHOP_EXPANDED_TEAM_CAMP_LIMIT whole-team camp purchases. */
export const SHOP_EXPANDED_PLAYER_CAMP_LIMIT = 3
export const SHOP_EXPANDED_TEAM_CAMP_LIMIT = 1

/** Cost of sending one player to camp. */
export const PLAYER_CAMP_COST = 60
/** Cost of sending the whole roster to camp -- pricier than stacking individual player camps
 *  would be, offset by the per-player boost being smaller (see TEAM_CAMP_ATTRIBUTE_SHIFT_*
 *  below) so it's a breadth-vs-depth choice, not a strictly better buy. */
export const TEAM_CAMP_COST = 350

/** Bounded random attribute-point boost a single-player camp applies -- same mechanic as Tier
 *  3's wildcard breakout (run/variation/wildcardEvents.ts's BREAKOUT_SHIFT), chosen and paid for
 *  instead of random and free. */
export const CAMP_ATTRIBUTE_SHIFT_MIN = 3
export const CAMP_ATTRIBUTE_SHIFT_MAX = 6

/** Per-player boost for a team camp -- capped lower than a single-player camp's since it lands
 *  on the whole roster at once. */
export const TEAM_CAMP_ATTRIBUTE_SHIFT_MIN = 2
export const TEAM_CAMP_ATTRIBUTE_SHIFT_MAX = 4

// --- Coaching Upgrades (Section 8.6), Phase 8 -- first-pass numbers, needs playtesting to tune ---
// A small persistent pool of 9 named cards (run/coachingUpgrades/catalog.ts), each a one-time,
// permanent nudge to one rating/attribute the simulation already reads -- same "flat, permanent
// shift" mechanic as roster quirks and wildcard events, just GM-purchased instead of imposed.
// Acquired through the shop's rolled-offer-plus-reroll flow (the one piece of the pre-Phase-7-
// rework shop mechanic that was kept, since these aren't a free player pick the way camps are).

/** Flat cost to buy any one coaching-upgrade card -- same price regardless of card for this first
 *  pass, unlike camps' condensed/expanded cost split. */
export const COACHING_UPGRADE_COST = 300

/** Candidates rolled each shop visit -- fewer on the every-season condensed tier, matching how
 *  camp purchase power splits across the two tiers. */
export const COACHING_UPGRADE_DRAFT_SIZE_CONDENSED = 1
export const COACHING_UPGRADE_DRAFT_SIZE_EXPANDED = 2

/** Free rerolls granted on the expanded tier only -- mirrors the pre-rework shop's
 *  SHOP_EXPANDED_REROLLS, kept alive here since coaching upgrades are still a rolled offer. */
export const COACHING_UPGRADE_REROLLS_EXPANDED = 1

/** Roster-wide hidden.clutch boost (Clutch Gene) -- feeds engine/possession/variance.ts's
 *  computeClutchBonus, active only in the same late-game window every player's Clutch already is. */
export const CLUTCH_GENE_CLUTCH_SHIFT = 12

/** Roster-wide hidden.durability boost (Iron Man Program) -- feeds engine/rotation/fatigue.ts's
 *  gain/recovery multiplier, same hook every player's Durability already uses. */
export const IRON_MAN_DURABILITY_SHIFT = 12

/** Roster-wide ballHandling boost (Film Study) -- feeds engine/possession/outcomeResolver.ts's
 *  turnover formula (ballHandling vs. defender pressure): sharper prep reads as fewer live-ball
 *  turnovers, without inventing a new "scouting" mechanic. */
export const FILM_STUDY_BALL_HANDLING_SHIFT = 6

/** Roster-wide interiorDefense/perimeterDefense boost, applied to both (Defensive Coordinator) --
 *  feeds engine/possession/resistance.ts's computeResistance directly through the defenders
 *  already read there. */
export const DEFENSIVE_COORDINATOR_DEFENSE_SHIFT = 8

/** Roster-wide hidden.consistency boost (Steady Hand) -- feeds engine/possession/variance.ts's
 *  computeConsistencyNoise, shrinking the same night-to-night swing every player's Consistency
 *  already governs. */
export const STEADY_HAND_CONSISTENCY_SHIFT = 12

/** headCoachRating boost (Player Development Guru) -- feeds engine/development/dpFormula.ts's
 *  coaching multiplier directly. One-time, unlike synergy's bonuses below: nothing ever
 *  recomputes headCoachRating from scratch the way camps recompute synergyScore. */
export const PLAYER_DEVELOPMENT_GURU_RATING_BONUS = 12

/** All-attribute boost for the CURRENT bench (roster minus startingFive) at purchase time (Bench
 *  Mob Mentality) -- feeds engine/rotation/substitution.ts's rotationValue via the bench
 *  candidates' own attributes, same as any other roster-wide shift. Targets a snapshot of the
 *  bench rather than re-deriving it later since startingFive never changes mid-run. */
export const BENCH_MOB_ATTRIBUTE_SHIFT = 6

/** Flat Team.synergyScore bonus for owning Players' Coach / System Guru -- feeds
 *  engine/possession/possessionStrength.ts's synergyMultiplier the same way roster-fit synergy
 *  does. Re-added on top of the roster-fit score every time it's recomputed (see
 *  run/coachingUpgrades/synergyBonus.ts) rather than applied as a one-time mutation, so a later
 *  camp purchase's full synergy recompute can't silently erase it. System Guru's is larger,
 *  reflecting deeper system mastery vs. Players' Coach's general chemistry bump. */
export const PLAYERS_COACH_SYNERGY_BONUS = 6
export const SYSTEM_GURU_SYNERGY_BONUS = 10
