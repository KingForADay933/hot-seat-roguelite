**Working Title:** TBD — see Section 0 for name candidates
**Status:** Concept / pre-build
**Project type:** Spinoff of Hoop Sim, built toward eventual commercial release (itch.io first, Steam as a later goal)
**Relationship to Hoop Sim:** Separate product, shared engine foundation — see Section 5

---

## 0. Naming (open, not yet decided)

**Candidates so far:**

| Name | Tone |
|---|---|
| Hot Seat | Pressure/stakes, punchy |
| Pink Slip | Blunt, firing-mechanic-forward |
| Full Court Pressure | Basketball pun on GM stress |
| Contract Year | Stakes framing |
| Rebuild or Bust | Wry |
| Waiver Wire | Dark-funny double meaning |
| One Season | Evocative, melancholy |
| Small Market | Underdog framing |

Leading candidates: **Hot Seat**, **Waiver Wire**. Revisit once the core loop is prototyped — a working build often clarifies which name actually fits the feel of playing it.

---

## 1. Vision & Core Pillars

A short-session, replayable basketball GM roguelite: take over a bad team, fight to hit an escalating target before you're fired, and see how long you can survive. Where Hoop Sim is a deep, ongoing franchise simulation, this is its opposite in structure but shares the same DNA — the same simulation engine, narrated through the same possession-log-driven commentary and insights, repackaged around **stakes and replayability** instead of **depth and persistence**.

**Core fantasy:** "How long can I survive as a GM before I get fired?" — pressure and consequence, not empire-building.

**Core pillars:**
1. **Short, complete runs** — a full run should be finishable in a sitting or two, not a multi-week save file
2. **Real stakes** — no save-scumming; getting fired ends the run and produces a story worth having, not a failure screen
3. **Replayability through variation** — procedurally varied starting constraints per run keep repeat plays feeling different
4. **Reuse Hoop Sim's differentiation** — commentary and coaching insights aren't ported over as an afterthought; they're the emotional payoff of every run's ending

---

## 2. Core Loop

**One run:**
- Start in control of a **bad team** — bottom-tier roster, generated via the same team/player generator Hoop Sim already has. No team selection; the game hands you the hard hand on purpose.
- **3 seasons** to hit a target (e.g., make the playoffs, or finish top-half of standings).
- **Miss the target after season 3 → fired, run ends.** Final score/summary tallied.
- **Hit the target → the run continues** with a harder target for the next stretch — escalating difficulty, so a skilled or lucky run can go longer than a fixed ceiling would allow.

**Session length target:** one season (sim + commentary/insights) should play in roughly **5–10 minutes** — short enough that "one more run" is an easy yes. This likely means a shortened season length (e.g. 30–40 games) rather than Hoop Sim's full 82-game default, which is its own tunable constant, not a hardcoded assumption.

---

## 3. Run Variation (the replayability hook)

Randomize 2–3 axes per run so replays feel meaningfully different, not just re-rolled numbers:

- **Starting roster quirk** — e.g. "stacked at guard, nothing at center," "one aging superstar, rest are rookies," "balanced but low-ceiling"
- **A house rule for the run** — e.g. "no trades allowed," "unusually tight cap," "must start at least 2 players under 22"
- **A wildcard event mid-run** — e.g. a rival's superstar declines an expected trade, a random young player "breaks out" — small, log-worthy moments the commentary/insights engine can narrate directly

---

## 4. Stakes, Ending, and Meta-Progression

**Permadeath framing**
- One run, one outcome. No save-scumming.
- Getting fired is framed as the natural end of a run — a story worth having — not a failure state.
- **Post-run summary screen** is the emotional payoff: Hoop Sim's Coaching Insights engine is a natural fit here — "here's what actually got you fired," reusing the same possession-log-derived reasoning Hoop Sim already generates, just aimed at a run's ending instead of a single game's box score.

**Meta-progression (the "just one more run" hook)**
- **Local leaderboard** — longest survival streak, best single-season record. No backend needed; matches the local-only architecture both this project and Hoop Sim already use.
- **Light unlocks between runs** — e.g. new house-rule variants unlock the more you play, giving later runs more variety without requiring a large content library up front.

---

## 5. Relationship to Hoop Sim (what's reused vs. new)

**Reused directly (already built in Hoop Sim):**
- Player/Team/League generator
- Possession log + fast-sim engine
- Broadcast Commentary
- Coaching Insights (arguably *more* valuable here — every run ends in an explainable verdict, not just a single game)

**New for this project:**
- The fired/escalating-target run wrapper (win/loss conditions, season count, difficulty escalation)
- Run variation system (roster quirks, house rules, wildcard events)
- Post-run summary screen
- Local leaderboard + unlock system
- Shortened season-length tuning (distinct from Hoop Sim's default pacing)

**Explicitly not reused:** Hoop Sim's persistence/ongoing-franchise systems (multi-decade saves, aging/retirement, draft/free agency as currently scoped) — this project's structure is bounded runs, not an ongoing save.

---

## 6. Tech Stack & Distribution

### 6.1 Core stack (same as Hoop Sim)
- **TypeScript + React + Vite** — maximum code and skill reuse; this is a spinoff, not a rewrite
- **Persistence:** localStorage, same as Hoop Sim, for now — sufficient for run history/leaderboard data; revisit only if Steam Cloud saves become a priority later

### 6.2 Distribution path (staged, not built all at once)

1. **Browser build, validated on itch.io first.** No packaging needed — same "play in browser" model as Hoop Sim. Goal at this stage is validating that the core loop (short run, real stakes, escalating pressure) is actually fun, before investing in packaging work.
2. **Electron-wrapped downloadable build**, added once the core loop is validated. Electron packages the existing web app into a native desktop app (Windows/Mac/Linux) — same React/TypeScript code, no rewrite. Can be offered as a downloadable build on itch.io alongside the browser version.
3. **Steam release**, via the same Electron build. Steam requires an installable app (not a browser link), which the Electron wrapper already provides. `steamworks.js` is the current, maintained library for wiring Steamworks features into an Electron app — this is a well-documented, proven combination, not a novel pipeline.
   - **Steamworks integration targets:** Achievements and leaderboards map directly onto the meta-progression system already designed in Section 4 — build the local-only version first, wire it to Steamworks calls later behind a swappable interface (same pattern Hoop Sim already uses for its storage adapter).

**Sequencing principle:** don't build the Electron/Steamworks pipeline before the core loop is proven fun. Iterate on the loop as a plain browser app first — faster iteration via browser refresh than rebuilding an Electron app on every change — and only invest in packaging once itch.io validation suggests it's worth it.

### 6.3 Pricing/positioning (early thinking)
- Likely a low price point ($3–$15 range) consistent with successful small-scope solo-dev roguelites — the goal is a tight, complete experience, not a large content library justifying a higher price.
- Free or pay-what-you-want on itch.io initially, for validation purposes — revenue isn't the goal at that stage, learning whether the hook lands is.

---

## 7. Open Design Questions / Parking Lot

- Exact win-condition target(s) per season (playoffs vs. standings threshold vs. something else) — not yet decided
- How difficulty escalates precisely after a successful season (harder target? less favorable starting roster next stretch? both?) — not yet decided
- **Overall run variance currently reads as too forgiving in playtesting** — tighten it (steeper stretch escalation, tighter attribute-shift/wildcard rolls, less snowball-friendly economy) to raise the stakes further. Expected to matter even more once the playoffs/championship-expectations target (bullet above) is designed in — a playoff-style bar adds its own variance on top of the regular-season one, it doesn't replace the need for this.
- Whether wildcard events need their own small content system or can reuse Hoop Sim's existing commentary templates with new trigger conditions
- Unlock system specifics — what unlocks, in what order, how many house-rule variants are needed for launch vs. added post-launch
- Whether this ships as a fully separate codebase/repo from Hoop Sim, or a shared-engine-with-two-apps structure — leaning separate repo for cleanliness, not yet finalized

---

## 8. Build-Crafting Meta-Layer (Roguelite Economy)

**Status:** Design converged via ideation session, not yet implemented. Extends Section 3's variation model and replaces Section 4's "light unlocks" placeholder with a concrete system. Builds on top of the codebase established in Phases 0–3 of the `hot-seat-roguelite` implementation (ported engine; target/fired run wrapper; roster quirks, house rules, and wildcard events).

**Core idea:** if Sections 1–4 describe Hot Seat's *pressure* loop (stakes, firing, escalation), this section describes its *agency* loop — the deckbuilder-roguelite layer of choices that let a GM build an identity over a run, à la Balatro. Two kinds of run-shaping elements exist side by side, deliberately serving different jobs:

- **Imposed** (no player choice) — market size, and the *fact* that a quirk/house rule/system will be forced on you. This is the hot seat: things happening *to* you.
- **Drafted** (player choice among a small rolled set) — *which* quirk, house rule, system, and shop item. This is the GM's agency: your answer to the hand you were dealt.

### 8.1 Market Size

Assigned randomly at run start, alongside (not replacing) the roster quirk and house rule. Governs the Budget economy (8.4) and how much patience the run gets. Two distinct axes — cash vs. patience — rather than one tier being strictly better than another:

| Market | Budget multiplier | Seasons per stretch |
|---|---|---|
| Big | 1.5x | 2 — no patience; ownership wants results now |
| Mid | 1.0x | 3 — current baseline |
| Small | 0.6x | 4 — fans stick with a rebuild |

`SEASONS_PER_STRETCH` was a global constant through Phase 3; this makes it run-scoped instead.

### 8.2 Drafted Quirks & House Rules

Supersedes Section 3's "randomize per run" framing for these two axes specifically: instead of auto-assigning one roster quirk and one house rule (as Phase 3 shipped), roll **2** candidates for each and let the player pick 1. The system draft below (8.3) is a full 3-option draft — quirks/house-rules stay tighter at 2, since they're framed as a limited hand of constraints rather than a wide-open build decision.

### 8.3 System Draft & Synergy

At run start, roll 3 candidate offensive systems — an expanded `OFFENSIVE_PLAYBOOKS` pool. Motion, Pace and Space, Iso-Heavy, and Balanced already exist; the five below are new entries, each just a play-call weight profile + ball-movement modifier like the existing four — and let the player pick 1.

Each system also has a **synergy identity**: which roster traits it rewards. This is where a drafted system interacts with the roster quirk you're stuck with — sometimes in your favor, sometimes not:

| System | Identity | Synergy rewards |
|---|---|---|
| 7 Seconds or Less | Push pace on every possession, spot-up off it | Speed, passing, outside shot |
| Princeton | Backdoor cuts, deliberate half-court passing | Passing, cutting, patience (low iso) |
| Triangle | Post entries feeding cutters and shooters | Inside presence + passing combo (versatile bigs) |
| Grit and Grind | Grind it out on the block, minimal ball movement | Inside shot, physicality — the "ugly but effective" option |
| Twin Towers | Feed the bigs, everything runs through the post | Inside shot, rebounding, vertical |

Twin Towers deliberately *anti-synergizes* with the Stacked-at-Guard roster quirk — drafting a system that fights your roster is meant to be a real tension (adapt your build vs. force a mismatch and hope camps fix it), not something the draft pool avoids.

Synergy activates the currently-inert `Team.synergyScore` field (dormant since Hoop Sim), feeding a small multiplier into offense strength. Synergy is expected to deepen over a run as camps, coaching upgrades, and consumables reinforce the chosen system — the closest thing this game has to Balatro's "build a deck around your jokers" identity.

### 8.4 The Shop & Budget

**Budget** is earned per season from performance (wins/standings), scaled by the market multiplier (8.1), with a bonus injection on every stretch-clear.

Two shop tiers, matching a two-tier cadence — but the tier now governs **purchase power** (how many camp buys, how much they can spend, what's unlocked), not a curated, pre-rolled offer list. The GM picks freely from the active roster for any camp purchase; the shop doesn't hand-pick which 2-3 players are eligible:

- **Condensed shop** (every season, after results): enough budget-tier access for one cheap single-player camp — but *which* player is entirely the GM's call.
- **Expanded shop** (stretch-clear only): more purchase power — multiple player camps and/or the pricier whole-team camp, plus (once 8.6/8.7 ship) coaching upgrades and system-reinforcement items, which stay randomly rolled and keep the reroll option meaningful. Reroll has no role for camps once player choice is free — it only applies to whatever's still randomly offered.

### 8.5 Camps

Send a player (or the whole team, pricier) to camp for an improved attribute — **the GM chooses both who goes and which specific attribute the camp targets**, not a rolled chance at whatever the game decides is optimal for that player. The size of the boost stays the same bounded-shift magnitude already used for Section 3's wildcard breakout event; what changes is that both axes (target player, target attribute) are deliberate choices, shop-gated and paid for, not random and free.

### 8.6 Coaching Upgrades

A small, persistent pool of named upgrade cards, each nudging one existing simulation constant rather than introducing a new mechanic. First-pass list for getting a build up and testable — not final, expect tuning/additions once playtesting starts:

- **Clutch Gene** — boosts clutch performance
- **Iron Man Program** — reduces fatigue gain / speeds recovery
- **Film Study** — boosts DP (development) rate
- **Players' Coach** — boosts morale, reduces slump odds
- **Defensive Coordinator** — boosts resistance / press pressure
- **Steady Hand** — reduces performance variance (a safer floor, not a higher ceiling — distinct from the pure-boost cards above)
- **Player Development Guru** — faster growth toward potential
- **Bench Mob Mentality** — boosts bench-player effectiveness — pairs with the Short Bench house rule
- **System Guru** — reinforces whichever system was drafted specifically (scales with the run's build, the most "Balatro joker" of the set)

### 8.7 Consumables

Cheap, temporary, single-season boosts (attribute- or synergy-flavored) bought in the shop but **held**, not instantly applied — an inventory capped at **3 slots**. Before each season begins, the player chooses which held consumables (if any) to burn on that season. The cap is what makes hoarding a real decision: holding a slot open means passing up a purchase elsewhere.

A consumable's boost flows through into that season's real player development (no separate "true baseline" tracked) — a clutch-fueled season can produce lasting organic growth, not just a one-off spike.

First-pass list for getting a build up and testable — not final:

- **Sports Psych Session** — +consistency/clutch for the season
- **Load Management** — -fatigue gain for the season — notably synergizes with the Short Bench house rule from Section 3
- **Film Room Marathon** — +system synergy for the season
- **Energy Drink Sponsorship** — +speed/vertical for the season
- **Extra Shootaround** — +outside shot for the season
- **Defensive Bootcamp** — +interior/perimeter defense for the season
- **Lucky Jersey** — small random attribute nudge, cheap and silly — pure texture, matching the "wry/dark-funny" tone from the Section 0 naming candidates

### 8.8 Cadence Summary

| Moment | What happens |
|---|---|
| Run start | Market size assigned. Draft 2→1 quirk, 2→1 house rule, 3→1 system. |
| Before each season | Loadout: burn 0–3 held consumables, or hold. |
| After each season | Condensed shop (small, cheap picks). |
| On stretch-clear | Bonus budget. Expanded shop (bigger picks). |

### 8.9 Relationship to what's already built

Reuses existing engine hooks rather than new simulation systems:

- `Team.synergyScore` (inert since Hoop Sim) — activated by 8.3
- `Coaching.headCoachRating` (single scalar) — expands into 8.6's named upgrades
- The attribute/multiplier-shift pattern from Phase 3's roster quirks and wildcard events — reused directly for camps (8.5) and consumables (8.7)
- `OFFENSIVE_PLAYBOOKS` (existing data table) — extended with new system entries for 8.3
- `SEASONS_PER_STRETCH` (currently a global constant) — needs to become run-scoped for 8.1

**New for this addendum:** Budget/economy state, shop UI, draft UI (quirks/house-rules/systems), consumable inventory + loadout UI, and the coaching-upgrade/consumable content pools themselves.

### 8.10 Open Questions

- First-pass content lists exist now (8.3, 8.6, 8.7) — intended as a starting/testing set, not final; expect additions and cuts once the build is playable
- Exact Budget earn/spend numbers (per-win amount, camp/upgrade/consumable prices, reroll cost) — needs playtesting to tune, not a design call yet
- Whether a camp's attribute choice (8.5) is unrestricted across every tracked attribute or narrowed to a shortlist relevant to the player's position/role — unrestricted is simpler to build and closer to a real GM's freedom, but risks degenerate min-maxing (dump every camp into the same attribute) if there's no soft guardrail
- Whether coaching upgrades stack, have limited slots, or are one-per-run
- Whether system draft options should be biased toward the roster's existing strengths, purely random, or intentionally offer a poor fit sometimes (a genuine "wrong system" risk)

### 8.11 Player Roles & Specializations

**Status:** Raised, not yet scoped. The player-level counterpart to 8.3's synergy identity — where 8.3 computes synergy from a roster's raw attribute fit to the drafted system, a role is a discrete, *named* tag a specific player carries ("this guy is a great cutter"), legible to the GM the same way a quirk or system name already is, rather than a hidden multiplier buried in attribute math.

First-pass list (not final — needs scoping same as 8.6/8.7's content pools):

| Role | Synergizes with |
|---|---|
| Great Cutter | Princeton, Motion Offense |
| Willing Passer | Princeton, Twin Towers |
| Spot-Up Shooter | 7 Seconds or Less, Pace and Space |
| Iso Scorer | Iso-Heavy |
| Shooter off Screens | Motion Offense, Pace and Space |
| Clutch Gene | Boosts this player's own clutch performance — name overlaps 8.6's team-level *Clutch Gene* coaching upgrade; needs reconciling (same effect at two scopes, or one gets renamed) |
| GOAT Potential | Not system-synergy-flavored — reads as a rare, high development-ceiling trait ("this player can become a franchise cornerstone") rather than a tactical fit, closer to a rare-card rarity tier than the rest of this list |

Open questions:
- Assignment mechanism — rolled at team generation (a hidden trait made visible), part of the run's draft (8.2/8.3's pattern), or shop-purchasable (extending 8.4's economy)?
- Can a player hold more than one role, or is it one each?
- Mechanical expression — a flat/scaled attribute-style boost, a play-call weight nudge (like a system's own profile), or a direct contribution to `Team.synergyScore` alongside 8.3's existing computation?

### 8.12 Team Specializations

**Status:** Raised, not yet scoped. The team-level counterpart to 8.11 — a named identity the roster as a whole carries or is built toward, sitting alongside 8.3's system-driven synergy score rather than necessarily replacing it.

First-pass list (not final):

| Specialization | Synergizes with |
|---|---|
| Ball Movement | Motion Offense, Princeton |
| Iso-Centric | Iso-Heavy |
| Great Spacing | Pace and Space, 7 Seconds or Less |
| Great Off-Ball Movement | Motion Offense, Princeton |
| Clutch-Time Boost | Team-wide performance bump in close/late situations |
| Morale Boost | Reduces slump odds / raises breakout odds (Section 3's wildcard events) — overlaps 8.6's planned *Players' Coach* upgrade; needs reconciling |

Open questions:
- Acquisition path — emergent from the roster's own player-role composition (8.11), a stretch-clear reward, or a shop purchase?
- Single specialization per team, or can multiple stack/compound?
- Relationship to `Team.synergyScore` (8.3) — a second, parallel score, or does it fold into the same number?
