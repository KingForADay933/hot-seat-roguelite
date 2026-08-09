**Status:** Living document / v1 shipped (MVP + usage-weighted selection + Bench Rotation + Franchise Mode v1) — planning v2 **Project type:** Personal passion project / learning project **Last updated:** August 2026

---

## Implementation Snapshot

Quick-scan status of every system this doc describes. Sections below still read as the living design for each system, whether it's shipped or not — this table is just the map.

| System | Status | Section |
|---|---|---|
| Data model + local persistence | ✅ Shipped | 2, 11.2 |
| Text-only game simulator (possession log + box score) | ✅ Shipped | 2.4, 5.5 |
| League management loop (schedule, standings) | ✅ Shipped | 2.3, 8 |
| Preset offensive/defensive strategies | ✅ Shipped | 5.2–5.4 |
| Usage-weighted shot/player selection | ✅ Shipped (post-MVP) | 5.5.1 |
| Bench rotation, fatigue, substitutions | ✅ Shipped (post-MVP) | 13 |
| Franchise Mode v1 (team control, strategy/lineup editing, season rollover) | ✅ Shipped (post-MVP) | 12 |
| Custom strategy editor | 🔜 Planned | 5.6 |
| Development system (DP / Training Focus) | ✅ Shipped (v1) | 3 |
| Synergy & Morale system | 🔜 Planned | 4 |
| Draft & Free Agency | 🔜 Planned | 12.2, 14 |
| Playoffs | 🔜 Planned | 12.2, 14 |
| Retirement / roster attrition | 🔜 Planned | 12.2, 14 |
| Saved/replayable games | 🔜 Planned | 6 |
| Simcast visual renderer | 🔜 Planned | 7 |
| Set plays | 🔜 Planned (v2+) | 5.7 |
| Reactive AI (defense-aware play calling) | 🔜 Planned (v2+) | 5.5 |
| Lineup screen: full player attributes | ✅ Shipped | 12.3 |
| Overtime rules | ✅ Shipped | 5.5, 14.2 |
| Broadcast Commentary (text play-by-play) | ✅ Shipped | 6.1, 14.1 |
| Live Play-by-Play Simulation View | ✅ Shipped | 6.2, 14.2 |
| Coaching Insights ("why" explanations) | ✅ Shipped | 6.3, 14.1 |
| Nuanced scoring attributes (dunk/layup, post/drive, iso/catch-and-shoot) | 🔜 Planned | 14.2 |
| Narrative Engine (auto-generated storylines) | 🔜 Planned | 14.1, 14.2 |
| Shareable Highlights (export) | 🔜 Planned | 14.1, 14.2 |
| Release Roadmap Phase 0 (W/L badges, Average Overall slider, Pace slider) | ✅ Shipped | 14.4 |

---

## 1. Vision & Core Pillars

A basketball management sim that combines the strategic depth of front-office simulators (Basketball GM, OOTP-style games) with a lightweight visual "simcast" layer, letting players watch their strategies play out rather than only reading a box score.

**Core fantasy (all three, blended):**

- **Mastermind Coach** — outsmart opponents through strategy and matchups
- **Builder/GM** — draft, develop, and grow a dynasty over multiple seasons
- **Storyteller** — build custom leagues, players, and rosters that feel like your own basketball universe

**Core pillars:**

1. Full custom creation — leagues, teams, players, all editable
2. Strategic depth via a shared preset/custom playbook system (offense & defense)
3. Two ways to experience a game: **Fast Sim** (instant box score) and **Simcast** (top-down visual playback), both driven by the same underlying possession log — no divergence between modes
4. A development "economy" that gives GMs real levers over how players grow
5. Team culture matters — strategy fit affects not just execution, but morale and development

---

## 2. Data Model

### 2.1 Player

**Identity/meta fields**

- Name, Age, Position(s) (supports multi-position, e.g. "PG/SG"), Height, Jersey Number, Team ID, Portrait/icon (placeholder-by-archetype is fine for v1)

**Core attributes (10 total)**

|Attribute|Description|
|---|---|
|Inside Shot|Finishing at the rim/close range, post scoring|
|Outside Shot|Perimeter/jump shot accuracy|
|Passing|Playmaking, assist generation, turnover avoidance|
|Ball Handling|Dribbling, driving, iso creation|
|Rebounding|Both ends (combined for v1)|
|Perimeter Defense|On-ball defense vs. guards/wings, contesting jumpers, lateral containment|
|Interior Defense|Post defense, rim protection, help positioning|
|Speed|Straight-line quickness, transition impact, closeouts|
|Lateral Quickness|Staying in front of ball-handlers; also affects offensive moves like blow-bys|
|Vertical|Rebounding boost, block potential, finishing above the rim, alley-oop feasibility|

> Note: Speed / Lateral Quickness / Vertical function as **modifiers feeding multiple outcomes**, not single-purpose stats — confirmed in practice as a real source of emergent depth (e.g., Switch-Everything specifically punishes a slow big in a way Man-to-Man doesn't, because that scheme reassigns the *worst*-fitting defender on the floor to a mismatch rather than the structurally-assigned one).

**Hidden/texture layers**

- **Consistency** — night-to-night variance; shipped, feeds a per-possession noise term in outcome resolution
- **Clutch** — performance modifier in close, late-game situations; shipped, active only inside a late-possession/close-score window
- **Durability** — shipped with a **dual role**: injury risk (still unbuilt — no injury simulation exists) *and* in-game fatigue resistance (built — higher Durability means slower fatigue gain and faster recovery on the bench; see Section 13)
- **Tendencies** — shoot-first vs. pass-first, preferred play type; shipped as a 3-value profile (pass-first / balanced / shoot-first), used as part of the Isolation shot-selection substitution (Section 5.5.1)
- **Morale** — see Section 4; field exists on the type, system itself not yet built

**Development fields**

- **Potential** — ceiling per attribute; field exists, not yet consumed by any growth system (Development System is unbuilt)
- **Development Points (DP)** — see Section 3; unbuilt
- **Age curve stage** — rising / peak / decline; **shipped and live** — recalculated every season rollover (Section 12) as a player ages, independent of the (still unbuilt) DP/growth system

**Derived/calculated**

- Overall rating — for UI/scouting flavor only; confirmed in practice as a hard rule — simulation and in-game rotation logic never read it, only raw attributes (roster-construction code, like picking a starting five by rating, is the one sanctioned exception)
- Fatigue/stamina — implemented exactly as originally planned: **ephemeral, in-game-only state that resets every game**, never persisted on the `Player` record itself (see Section 13)

### 2.2 Team

- Name, City, Abbreviation, Logo/colors
- Roster (Player IDs, max roster size)
- **Starting five and target rotation minutes — shipped, both auto-generated and GM-editable** (Franchise Mode's My Team screen, Section 12) for the user's controlled team; AI teams keep their auto-generated values
- Assigned Offensive Strategy + Defensive Strategy (preset shipped; custom editor still unbuilt) — user-editable for the Franchise team, auto-assigned for AI teams
- Coaching staff (Head Coach rating field exists; multiplier effects unbuilt)
- Practice time allocation settings (unbuilt)
- Team Synergy Score (field exists, unbuilt — see Section 4)
- Season record, standings position (standings are computed on demand from game results, not read from a cached field)
- Salary cap/budget — still deferred, no change

### 2.3 League

- Name, structure (single division shipped; conferences/divisions/custom formats still just an idea)
- Team list
- Season schedule (games: date, home/away, result) — shipped, round-robin generator
- Rules config: season length (shipped), playoff format (still `null` — no playoffs), roster limits (implicit via max roster size), draft settings (n/a, no draft yet)
- Standings (derived, shipped)
- League-wide sim settings — shipped in a minimal form (possessions-per-game pace field); no era/style presets beyond that yet
- **New since MVP:** the team the user controls (`userControlledTeamId`), the current season number, and a season-by-season history of final standings — all Franchise Mode fields, see Section 12

### 2.4 Game

- Home team, Away team, Date
- Result: final score, full box score (per-player stats, now including minutes played — Section 13)
- **Possession Log** — structured, ordered list of possession events; the single source of truth for both Fast Sim output and (future) Simcast rendering. Shipped, and it grew two fields beyond the original sketch once substitutions existed: each entry now also carries which five players were on the floor per team at that moment, since that's no longer fixed for the whole game.
- `isSaved: boolean` flag (see Section 6) — field exists, feature not built

**Possession log entry (actual shape):**

```
{
  possessionNumber,
  offenseTeamId,
  playCallUsed,
  primaryPlayerId, secondaryPlayerIds[],
  outcome: make | miss | turnover | foul,
  pointsScored,
  isThreePointAttempt,
  playersInvolved[],
  homeOnCourtIds[], awayOnCourtIds[]
}
```

---

## 3. Development System

**Status: ✅ v1 shipped.** Design below is the original plan, refined once (the Training Focus rework) before any code existed for it — kept intentionally ahead of implementation so the min-maxing risk was designed out before it was ever a live problem. See "v1 implementation notes" at the end of this section for exactly what shipped vs. what's still deferred.

Players earn and spend **Development Points (DP)** each season. Multiple systems feed into DP, giving different GM philosophies distinct paths to developing talent.

**DP earned from:**

- **Base DP (age-driven)** — young players earn more; veterans earn little/none; players in decline phase may earn negative DP without intervention
- **Playing time bonus** — minutes played this season scale DP earned (creates real tension between "win now with vets" and "develop the kid")
- **Practice allocation bonus** — see below
- **Coaching multiplier** — applies to all DP earned, from Head Coach's Player Development rating

**DP Allocation (Training Focus)**

- GM allocates DP into specific attributes (season-end, or rolling allocation) — but DP is **not** a directly-spendable currency that converts 1:1 into attribute points. Allocating DP to an attribute instead raises that attribute's **Training Focus**, a rate modifier applied during season-end growth resolution.
- At season-end, focused attributes close the gap toward the player's hidden **Potential** cap significantly faster than unfocused ones; attributes with no allocated focus still grow slowly from Base/Playing-time DP alone. Potential remains the hard ceiling either way, and progress naturally tapers as an attribute nears it (closing a gap gets smaller as the gap gets smaller).
- **v1 design decision:** DP was deliberately kept out of "bank it and dump it into one stat" territory. A direct-currency model lets a GM instantly snipe a player to elite in a single attribute the moment enough DP accumulates, which breaks growth pacing and invites min-maxing that fights the rest of the game's balance (Section 4's synergy/fit systems assume gradual, organic development). Modeling DP as a focus/rate modifier keeps growth smooth across a season while still giving allocation real, meaningful weight.

**Practice Time Allocation**

- Limited resource per team, assigned by the GM across categories: e.g., Team Offense Reps, Individual Skill Development, Conditioning/Health, Strategy Execution Drilling
- **Key tradeoff:** heavy team-strategy practice improves strategy execution fidelity (Section 4) but reduces individual player development, and vice versa

**Coaching Quality**

- Coaches are their own entity (Head Coach first; Assistant/Position coaches as a later addition), with their own ratings:
    - **Player Development** — multiplies DP earned
    - **Strategy Execution / Playcalling** — multiplies synergy/execution quality
    - **Motivation** — feeds team morale
- Makes coaching hires a meaningful GM decision, not flavor text

**v1 implementation notes**

- **Potential became a per-attribute map**, not a single scalar — this doc always called it "ceiling per attribute" (Section 2.1); the field just hadn't been built to match yet. Rolled once at generation off each attribute's own current value, never re-rolled as a player ages.
- **DP formula shipped exactly as specced** (age/stage base, playing-time bonus, practice bonus, coaching multiplier) — `engine/development/dpFormula.ts`. One non-obvious ruling: the coaching multiplier *divides* a negative (declining) net DP rather than multiplying it, so a good coach always helps regardless of which direction a player is trending, instead of accidentally accelerating decline.
- **Growth resolution** (`engine/development/growPlayerOneSeason.ts`) splits positive net DP into a small even trickle across all 10 attributes plus a Training-Focus-weighted majority share, both tapered by an ease-out factor as the gap-to-potential narrows — exactly the "closing the gap gets smaller as the gap gets smaller" rule above. Decline-phase negative DP decays attributes evenly (not focus-weighted — Training Focus is an investment, not a shield) down to a floor, since no retirement/roster-turnover system exists yet to remove a long-lived veteran otherwise.
- **Practice Time Allocation is one lever in v1, not four.** Only "Individual Skill Development" (`PracticeSettings.individualDevelopmentShare`) feeds the DP formula; Team Offense Reps/Strategy Execution Drilling/Conditioning are deferred until Section 4 (Strategy Synergy & Morale) exists to give the "reduces individual development, improves strategy fidelity" tradeoff something real to land on. No UI was built for categories that would currently do nothing.
- **Coaching Quality is still a single scalar** (`Team.coaching.headCoachRating`) reused directly as the Player Development multiplier — the multi-rating Coach-as-entity idea (Strategy Execution, Motivation) is explicitly deferred alongside Section 4, for the same reason.
- **Training Focus allocation never blocks season rollover.** A player with no GM override auto-allocates focus proportional to each attribute's gap-to-potential — exactly what they'd get if the GM never opens the new Development screen at all, so there's no "forgot to allocate, wasted a season" trap. Lives on `Team.trainingFocus` (mirroring the existing `rotationMinutes` shape) rather than on `Player`, avoiding a new per-player update action.

---

## 4. Strategy Synergy & Morale System

**Status: not yet built.** `Team.synergyScore` and `Player.hidden.morale` exist on the types as placeholders; nothing computes or reads them yet.

This system connects roster construction, strategy assignment, on-court execution, player development, and team morale into one feedback loop.

**Player-Strategy Fit**

- Each player's fit for a given play call/strategy is _derived from existing attributes and tendencies_ — no separate hidden fit stat needed
- Example: high-IQ, high-Passing players fit Motion/Princeton-style offenses; high-Ball-Handling, shoot-first players fit Iso-heavy offenses

**Team Synergy Score**

- Aggregate of individual fit scores across the roster, weighted by minutes played (stars' fit matters more than bench fit)
- Produces a single score representing "how well this roster matches this system"

**Passive effects of synergy:**

|Area|Effect|
|---|---|
|On-court execution|Higher synergy → outcomes closer to "ideal" distribution (fewer broken possessions/turnovers, better shot quality); feeds directly into possession log generation|
|Development|Players in high-fit roles develop faster (realistic skill reinforcement); badly miscast players may stagnate or decline|
|Morale|New stat: **Morale**, affected by fit, winning, playing time vs. expectations, and coaching Motivation rating. Morale affects in-game performance variance/consistency, and (future) trade/free-agency willingness|

**The GM's three competing levers each season:**

1. **Win now** — heavy minutes for best fits/veterans
2. **Develop for later** — spread minutes/practice to prospects even off-fit
3. **Team culture** — keep morale/synergy healthy enough that 1 and 2 don't backfire

---

## 5. Strategy / Playbook System

### 5.1 Two layers

- **Playbook (identity)** — the team's overall system/philosophy; what's assigned per team and what fit is calculated against
- **Play Calls (execution)** — individual actions run within that system per possession; what generates possession log entries

A playbook is a **weighted set of play call primitives** plus tempo/style modifiers. This avoids needing to hand-design each playbook from scratch — presets and custom strategies both draw from the same primitive library.

### 5.2 Offensive play call primitives (shipped)

|Play Call|Key dependencies|
|---|---|
|Pick-and-Roll|Ball Handling, Passing (handler); Inside Shot, Vertical (roller)|
|Isolation|Ball Handling, Outside/Inside Shot, shot-selection discipline (Passing + Tendencies — see 5.5.1)|
|Post-Up|Inside Shot, Vertical (strength proxy folded in for v1)|
|Spot-Up / Catch-and-Shoot|Outside Shot (shooter), Passing (creator)|
|Cutting / Off-ball movement|Passing + Speed (timing/separation proxy — see 5.5.1)|
|Transition|Speed, Passing, team Rebounding (outlet)|

_Fast-break/handoff actions: candidate additions once primitives are validated._

### 5.3 Playbook = recipe (shipped presets)

Four presets shipped, each a weighted distribution over the primitives above plus a ball-movement modifier (scales passing-dependent play calls):

- **Motion Offense:** 30% Cutting, 25% Spot-Up, 20% Pick-and-Roll, 15% Post-Up, 10% Isolation — modifier ×1.15
- **Iso-Heavy:** 45% Isolation, 20% Post-Up, 20% Pick-and-Roll, 15% Spot-Up — modifier ×0.85 (more predictable; more exploitable at low synergy, once synergy exists)
- **Balanced Attack:** 25% Pick-and-Roll, 20% Spot-Up, 20% Isolation, 15% Post-Up, 15% Cutting, 5% Transition — modifier ×1.0
- **Pace and Space:** 30% Spot-Up, 25% Pick-and-Roll, 20% Transition, 15% Cutting, 10% Isolation — modifier ×1.1

### 5.4 Defensive schemes (shipped, mirrors offense structure)

|Scheme|Dependency profile|
|---|---|
|Man-to-Man|Balanced across Perimeter/Interior Defense|
|Zone|Positioning-driven, less individual-matchup dependent|
|Switch-Everything|Leans on Lateral Quickness + Perimeter Defense **across the whole roster** — weak-link matters, not just stars. The only scheme where defender assignment ignores the fixed positional matchup and always picks the single worst-fitting defender on the floor for whatever's being attacked.|
|Pack-the-Paint|Leans on Interior Defense/Vertical from bigs; more forgiving of weak perimeter defenders|
|Full-Court Press|Speed, Lateral Quickness, Passing (to break it) — modeled as a standing backcourt-pressure term on every possession, not just a press-specific event|

Defensive fit works identically to offensive fit — mismatched personnel (e.g., slow bigs in a switch-heavy scheme) hurts execution and can be exploited. (Synergy/fit *scoring* itself — Section 4 — isn't built yet; what's shipped is the raw mechanical consequence of the mismatch inside possession resolution.)

### 5.5 Possession resolution (shipped)

1. **Play call draw** — offense draws a play call from its playbook's weighted distribution (weights needn't sum to 1; normalized at draw time).
2. **Player & matchup selection** — the play call determines which on-court role(s) matter (e.g. Pick-and-Roll needs a ball-handling/passing "creator" and an inside-shot/vertical "roller"); candidates are chosen via **usage-weighted selection** (5.5.1), not always the single best fit. Defenders are assigned by a fixed position-to-position matchup, except under Switch-Everything (5.4).
3. **Turnover check** — resolved *before* any shot attempt, from the ball-handler's Ball Handling vs. the defender's pressure. A turnover possession never also rolls a shot.
4. **Strength vs. resistance** — offensive strength (attribute-weighted per play call, scaled by the playbook's ball-movement modifier) is compared against defensive resistance (attribute-weighted per play call, scaled by the scheme's coefficients), with Consistency/Clutch adding possession-level variance, to produce a make probability.
5. **Outcome** — make / miss / foul is rolled from that probability; a make's points (2 vs. 3) are fixed by which shot type the play call represents, not a separate roll.
6. **Log** — the possession is recorded as a `PossessionLogEntry`, including which five players were on the floor per team (needed once substitutions exist — Section 13).

> **v1 design decision (confirmed correct in practice):** offense and defense still resolve independently — no reactive mid-possession adjustment. Fit/mismatches shine through clearly via the resistance calculation without needing reactive AI. **Stretch goal (v2+):** Reactive AI.

#### 5.5.1 Usage-weighted selection (shipped, post-MVP addition)

The first implementation always handed the ball to the single best-fit player for a given role, every time that play call came up — since "best fit" never changes possession to possession, 2–3 of 5 players on a team could finish a full game with zero shot attempts. Fixed by making *offensive* role selection weighted-random instead of deterministic: each candidate's selection weight is their fit score raised to a tunable concentration exponent, so the best-fit player is still picked most often but every eligible player has a real, non-zero chance. Defender assignment stayed deterministic — matchups are a structural/coaching decision, not a randomized one, matching how Switch-Everything's worst-link pick also isn't randomized.

> **Resolved:** the Section 5.2 "IQ" dependency (Isolation shot selection, Cutting) was never a defined attribute — an inconsistency caught during implementation, not part of the original attribute design. Rather than adding an 11th attribute (which would also contradict Section 4's "no separate hidden fit stat" philosophy), it's implemented as: **Passing** standing in for shot-selection discipline/decision-making, and **(Passing + Speed)/2** for Cutting specifically (off-ball timing + separation), with Isolation's shot-selection term also reading **Tendencies**.

#### 5.5.2 Overtime (shipped)

Mirrors the real NBA rules rather than inventing a house rule. If regulation ends level, the game keeps playing extra periods — never capped — until someone's ahead:

- **Period length:** 5 real minutes per period, at the *same pace* (possessions-per-minute) as regulation, derived from whatever `possessionsPerGame` a given league is configured with rather than a hardcoded possession count. A 100-possession-pace game gets 10-possession overtimes; a faster- or slower-paced league's overtimes scale accordingly. Floored at 1 possession so an extreme low-pace configuration can never produce a zero-length period, which would otherwise let the "keep going until decided" loop spin forever without the score ever changing.
- **Jump ball:** every period gets one, including regulation's opening tip, not just overtime — `rollJumpBall()` is a neutral coin flip deciding first possession, deliberately *not* skill-weighted (e.g., by a center's Vertical) to keep the v1 version simple. Regulation no longer has a fixed "home always starts on offense" rule; that was a placeholder from before overtime existed, and leaving it in place would have meant only overtime periods ever had real jump balls while every ordinary game still opened on a scripted, unrealistic "home controls the tip every single time."
- **Continuity:** fatigue and the bench rotation (Section 13) carry over from regulation into overtime untouched — nobody gets fresh legs just because the period changed, exactly like real basketball. This also means a player's minutes can legitimately exceed 48 in an overtime game, which is correct, not a bug.
- **Consequence:** `computeStandings` (Section 2.3) no longer needs its old arbitrary tie-break — a tied final score should never reach it now that `simulateGame` itself guarantees a decisive winner. The defensive tie-break logic was kept in place (rather than deleted) purely for any hand-built test fixture that feeds in tied data directly, since `computeStandings` is a generic pure function, not exclusively fed by `simulateGame`'s output.
- **Forward-looking (no schema change needed yet):** who won a given period's jump ball isn't stored as its own field anywhere — it doesn't need to be, since it's exactly `possessionLog` entry for that period's first possession's `offenseTeamId`. Broadcast Commentary and Simcast (Section 14) can read that directly once built ("and Team X controls the opening tip!") rather than needing new state invented for them. `rollJumpBall()` is named and exported specifically so those future features have one clear, documented concept to hook into rather than re-deriving "was this a jump ball possession" from scratch.

### 5.6 Custom strategies

**Status: not yet built.** Custom strategies use the **same data structure** as presets — presets are just pre-filled recipes shipped with the game; "custom" unlocks the same editor.

- Set % distribution across play calls (must total 100%; sliders or drag-to-allocate UI)
- Set tempo (possessions per game — faster tempo = more possessions, but lower shot quality without the Passing/IQ to support it)
- _(Phase 2)_ Situational overrides — e.g., shift distribution in the final 2 minutes of a game

### 5.7 Future addition: Set Plays (v2+)

**Status: not yet built.** A **selectable list of set plays** to add to a team's playbook, layered in after core systems are proven.

- Conceptually: a set play is a special play-call primitive with a **scripted sequence** of actions rather than a single resolved action (e.g., "screen for the shooter → shoot or dump to the roller")
- Uses the same fit/execution math as other play calls — just a more specific action drawn from the playbook distribution
- Not required for v1; noted here for future scoping

---

## 6. Possession Log Storage

- **Rolling window — shipped.** Full possession logs are retained for the current season only. Season rollover (Section 12) genuinely discards the completed season's `Game` objects — possession logs included — and replaces them with a compact `SeasonSummary` (final standings only). The original plan here turned out to be exactly right once there was code to test it against.
- **Saved games — not yet built.** `Game.isSaved` exists on the type as planned, but nothing sets it or exposes a "save this game" action yet; every game's log is purged at rollover regardless of how interesting that game was.
- Saving, once built, should still not be required in advance — a player should be able to save any game from the current season at any point before rollover purges it.
- Side benefit once built: the eventual Simcast renderer doubles as a **replay system** for any past (unpurged or saved) game — worth surfacing directly in the UI (e.g., "Watch Replay" on any box score, not just live/upcoming games).

### 6.1 Broadcast Commentary — ✅ shipped

The first of the four differentiation features (Section 14.1) and the cheapest: turns the possession log into readable play-by-play sentences on the Box Score screen, instead of only the raw table. No new simulation logic, no new data — purely a presentation layer reading fields the log already has.

- **Generated on the fly, never persisted.** No new field on `PossessionLogEntry` or `Game` — a pure function (`engine/commentary/generateCommentaryLine.ts`) derives text from the existing entry, the same pattern `boxScore.ts`/`standings.ts` already use to derive display data from the log.
- **Deterministic variety, not randomness.** Phrase variants cycle on `entry.possessionNumber` (`phrases[possessionNumber % phrases.length]`) rather than `Math.random()` — same game always renders identical commentary, no new rng dependency at render time, and trivially testable.
- **Composition over one template per combination.** An "action phrase" (how the opportunity happened, per play call — e.g. "Kessler runs a pick-and-roll with Okafor") composes with an "outcome phrase" (what happened, keyed by outcome + shot type — make2/make3/miss2/miss3/turnover/foul), multiplying a small authored set (`engine/commentary/templates.ts`) into much more apparent variety than the raw count of templates would suggest.
- **Known limitation:** turnover/foul commentary stays offense-focused ("Kessler loses the handle — turnover!") rather than naming a specific defender, since `PossessionLogEntry` doesn't disambiguate which player on defense forced a turnover or drew a foul (only an undifferentiated `playersInvolved` union). Flagged rather than fixed with a schema change, consistent with keeping this a presentation-only addition.
- **UI:** a "Commentary / Table" toggle inside the existing collapsible possession log section on Box Score, defaulting to Commentary; the original raw table is unchanged and still one click away. Running score is appended only after made baskets (e.g. "... (DUN 60–51 KGS)"), matching how real broadcasts don't repeat the score every possession. Verified reading naturally straight through an overtime game's extra possessions too.

### 6.2 Live Play-by-Play Simulation View — ✅ shipped

A text-only "watch it happen" mode for an unplayed game, built directly on top of Broadcast Commentary (6.1) — the foundation for eventually letting a user make in-game coaching decisions (Mastermind Coach pillar, Section 1), even though those decisions themselves aren't built yet.

- **The engine is steppable, not just "replay on a timer."** `engine/simulateGame.ts` now exposes `simulateGameSteps`, a generator that `yield`s a `SimulationStep` (one possession's log entry + running score) after each possession and `return`s the finished `Game` once every period — including any overtime — completes. `simulateGame()` itself is unchanged in behavior: it's now a thin wrapper that drains the generator to completion, so every existing caller (instant "Sim", "Sim Entire Season", season rollover) is byte-for-byte identical to before. This is the same generator that a future timeout/substitution/matchup-change feature will pause at — no second rewrite needed to make that possible, just an addition of an optional value passed into `.next()`.
- **New screen:** `ui/screens/LiveGameScreen.tsx`, reached via a "Watch Live" button next to "Sim" on any unplayed Schedule row. Steps the generator on a timer (~700ms/possession), rendering a live scoreboard and a growing commentary feed via the same `generateCommentaryLine` from 6.1 — one line at a time instead of all at once. Includes Pause/Resume and "Skip to End" (drains the same generator instance instantly, so skipping produces the exact outcome the broadcast was already heading toward, not a fresh roll).
- **Nothing new persisted.** The per-possession `SimulationStep` is transient, discarded once the finished `Game` is committed — same treatment as `RotationState` (Section 13). The only thing that reaches `localStorage` is the same `Game` shape a live game always produced.
- **Leaving mid-broadcast auto-completes rather than abandons.** There's no "partially played game" concept in the data model — navigating back to Schedule before playback finishes silently drains the same generator instantly and commits the result, rather than leaving the game stuck unplayed.
- **New display helper:** `getPeriodLabel` derives "Q1"–"Q4"/"OT"/"2OT" labels purely from possession counts, the same way `minutesPlayed` already stands in for a real game clock. Lives in `engine/simulateGame.ts` (moved there from `ui/formatOvertime.ts` once Coaching Insights, 6.3, needed the same logic engine-side).
- **Not yet built:** the actual interactive decision points this is scaffolding for — timeouts, substitutions, matchup changes, offensive/defensive emphasis (see Section 14.2). This view only makes the game *watchable* in real time; it doesn't yet let the user intervene in it.

### 6.3 Coaching Insights v1 — ✅ shipped

Turns math the sim already computes — weak-link matchup exploitation, fatigue-driven substitutions — into short "why" sentences for the GM after a game, e.g. *"Switch-Everything defense got picked on: Terrence Baptiste was matched up on 31 possessions this game, allowing 33 points"* or *"Damian Delgado was pulled with heavy fatigue in the Q4, Damian Solano checked in."* Same differentiation thesis as Broadcast Commentary: spend data that's already being collected.

- **Fully reconstructed from the existing possession log — no schema change, no changes to `simulateGame`/`playerSelector`/`substitution`.** Both insight types turned out to be deterministically recoverable after the fact purely from `PossessionLogEntry` + static team/player data, so nothing needed to be logged that wasn't already there:
  - **Weak-link matchup targeting** — for a defending team running a `weakLinkSensitive` scheme (currently only Switch-Everything), which specific defender would've been assigned each possession is a pure function of the play call, the offensive primary player's attributes, and the on-court five (all already on the log) — the exact same `worstPerimeterDefender`/`worstInteriorDefender` logic `playerSelector.ts` runs live, just re-run post-hoc, now exported for reuse.
  - **Fatigue-driven substitutions** — fatigue is a deterministic function of on-court history + each player's static `durability`, so replaying `tickFatigue` (unmodified, reused directly) possession-by-possession against the log's own on-court lists reproduces the exact fatigue trajectory the live sim had. A departing player whose reconstructed fatigue was at/above the sub-out threshold at that moment gets flagged.
- **New module:** `engine/insights/generateCoachingInsights.ts` — pure, rng-free, same shape as `boxScore.ts`/`generateCommentaryLine.ts` (derive display data from the log, touch nothing else). Capped at `INSIGHT_MAX_FATIGUE_EVENTS` (3) fatigue insights per game, prioritizing emergency-fatigue and later-in-game events, to avoid clutter in a game with a lot of natural rotation churn. Weak-link targeting requires crossing `INSIGHT_WEAK_LINK_MIN_TARGETING_COUNT` (4) possessions before it's called out.
- **v1 scope is exactly these two insight types**, per the original differentiation pitch (14.1). Pace-overage substitutions are detected by the same mechanism internally but deliberately not narrated yet — noise control, not a limitation.
- **UI:** a "Coaching Insights" section on Box Score, right after the score header and before the two box score tables — GM-level summary read before play-by-play detail. Renders nothing at all when no notable pattern occurred.

---

## 7. Simcast (Visual Playback)

**Status: not yet built.** Everything below remains the plan, unchanged since MVP — this is deliberately the last system to build (Section 8), once the possession log format has had time to settle under real usage (it has — Section 2.4 documents two fields that got added to it after the fact, which is exactly the kind of churn Simcast is meant to be built *after*, not during).

- **Visual style:** Simple 2D top-down court view — dots/icons representing players, in the style of Front Office Football / OOTP.
- **Key architecture principle:** Simcast does **not** run its own simulation. It **renders the possession log** that was already generated (by Fast Sim or live sim) — a "puppet show" driven by stored data, not a parallel simulation. This guarantees Fast Sim and Simcast can never diverge from each other.
- Determinism: replays render identically from the same possession log (no separate seed needed for playback since outcomes are pre-determined; only _movement/animation_ within a possession could vary cosmetically if desired later — not required for v1).

---

## 8. Build Order / Suggested Phasing

Original plan, annotated with actual progress:

1. **Data model** (Player, Team, League) + a barebones **text-only** game simulator — ✅ shipped
2. **League management loop** — schedule, standings, box scores — ✅ shipped (simple transactions still unbuilt: no trades, signings, or roster moves exist yet)
3. **Strategy system** layered onto the simulator — ✅ presets shipped; custom editor still unbuilt
4. **Development system** (DP, practice allocation, coaching multipliers) — 🔜 not yet built
5. **Synergy/morale system** — 🔜 not yet built
6. **Simcast visual renderer** — 🔜 not yet built
7. _(v2+)_ Set plays, reactive AI, deeper coaching staff, situational strategy overrides — 🔜 not yet built

**Actual order diverged from this plan after step 3.** Usage-weighted selection, the full bench rotation/fatigue system, and Franchise Mode v1 (team control, strategy/lineup editing, season rollover) were all built next, ahead of Development/Synergy/Simcast — prioritizing making the core game loop feel alive (real bench usage, a season worth following) before layering in systems that add strategic depth without changing what a single game *feels* like to watch play out. See Section 14 for what's next.

> Rationale that still held up: build the systems that generate _data_ before building the systems that _display_ it. Nothing about the actual build order violated this — Simcast is still last precisely because it wasn't safe to build until the possession log format proved stable, and it's proven anything but static.

---

## 9. Open Design Questions / Parking Lot

- **Rebounding split — resolved: keep combined for v1.** No current system (strategy, development, box score) consumes an Off/Def split; revisit only if put-back-style play calls get added later.
- **Strength attribute — resolved: keep folded into Inside Shot/Vertical.** Those already proxy post-up strength for the play calls that need it; a standalone 11th attribute has no dedicated dependency yet.
- **Assistant/Position coaches — resolved: single Head Coach rating for v1.** Follows directly from Section 11.4 — coaching multipliers themselves are post-MVP, so multiple coach roles would add depth to a system that doesn't exist yet.
- **Situational strategy overrides — resolved: v2**, consistent with the Phase 2 note already in Section 5.6.
- Reactive AI (defense-aware play calling) — confirmed v2+ stretch goal.
- Set play library — confirmed v2+ feature; needs its own design pass when scoped.
- **Out-of-position penalty — not yet designed, no current urgency.** `Player.positions` supports multiple natural positions, but nothing distinguishes "natural position" from "position currently being played," and there's no attribute penalty for a mismatch (e.g., a guard forced to play Center). Not reachable today — the roster generator guarantees 2+ players per position and the rotation/substitution system only ever slots a player into a position they already play — but becomes real the moment injuries or manual lineup edits exist. **Manual lineup edits now exist (Section 12)** and still can't reach this case, since the lineup editor picks from the existing roster without a positional constraint but nothing yet forces an out-of-position assignment either. Revisit when injuries land: likely a flat or scaling penalty to the affected attributes (Interior Defense/Rebounding when playing above one's natural position, Perimeter Defense/Lateral Quickness when playing below it) applied at the point a player is assigned an off-position slot.

---

## 10. Tech Notes (early thinking, not finalized)

> **Superseded by Section 11.** Kept for history — every decision sketched here was finalized, and in every case confirmed correct in practice, by the time of writing.

- Suggested stack for a solo/learning project: web-based (JS/TypeScript, Canvas or Phaser for the top-down Simcast view) for fast iteration and easy playtesting in-browser; alternatively Godot 2D if a dedicated game engine is preferred.
- Core principle: build the simulation engine and data model first, independent of any rendering layer, so the same engine can output both a box score (Fast Sim) and a possession log (Simcast source).

---

## 11. Technical Addendum (v1 build decisions)

This section locks in the decisions needed to start scaffolding — meant to be read alongside Sections 2–8 as the concrete brief for setup.

### 11.1 Platform & Stack

- **Format:** Browser-based web app (not desktop, not mobile, not a Godot/game-engine project for v1)
- **Language:** TypeScript
- **Rendering (Simcast):** HTML Canvas — plain Canvas API to start; only reach for a library like Phaser if raw Canvas work becomes unwieldy as complexity grows. Still unbuilt.
- **UI framework:** React, for the data-heavy management screens (roster, strategy editor, standings) — see Section 11.5.
- **Bundler/tooling:** Vite — see Section 11.5.
- **Rationale:** Matches current skill level (some scripting experience), matches the project's actual complexity profile (mostly data systems, not physics/graphics), and keeps the iteration loop fast (browser refresh, no build/export step). Held up in practice — nothing about the actual build strained this choice.

### 11.2 Data Persistence

- **v1: Local-only — shipped.** No backend/server, no remote database.
- Data (players, teams, leagues, possession logs) persists in **browser localStorage**, not IndexedDB as originally floated — a full season's possession logs turned out to be a few hundred KB of JSON, well under localStorage's quota, so the simpler synchronous API won out. The storage layer is written behind a small adapter interface specifically so swapping to IndexedDB later (if saved-games/multi-season retention ever needs the extra headroom) is a one-file change, not a rewrite.
- No schema-versioning/migration layer exists. A save from before a given feature shipped either degrades gracefully (e.g. missing Franchise fields route back to a fresh setup flow) or needs regenerating — an accepted v1 tradeoff, revisit if it ever affects a save worth preserving.
- **Explicitly deferred:** any client+server architecture, remote sync, multiplayer/shared leagues.

### 11.3 Type Modeling

- TypeScript interfaces/types are defined directly from the Section 2 data model (Player, Team, League, Game, PossessionLogEntry) — shipped, and this contract held up well: every post-MVP system (usage weighting, bench rotation, Franchise Mode) extended these types rather than needing to restructure them.

### 11.4 MVP Scope — ✅ shipped

Pulled from Section 8's build order, this was the concrete "v0.1 playable" cut:

**Shipped:**

- Data model + local persistence (Player, Team, League, Game)
- Text-only game simulator (no Simcast yet) — possession log generated, box score derived from it
- Basic league management loop: schedule, standings, simple box scores
- Preset strategies only (offense + defense)
- Independent possession resolution model (Section 5.5)

**Still out of scope (planned, later phases):**

- Custom strategy editor (sliders/allocation UI)
- Development system (DP, practice allocation, coaching multipliers)
- Synergy/morale system
- Simcast visual renderer
- Saved/replayable games feature
- Set plays, reactive AI (both already flagged v2+ in Section 5.7 / 5.5)

**Rationale (held up):** the smallest possible loop that's still genuinely "a basketball manager game" — create a league, sim a season, see standings — before layering in the systems that make it distinctive. Everything built after MVP (usage weighting, bench rotation, Franchise Mode) added richness to that same core loop rather than replacing it.

### 11.5 Tooling Decisions (resolved)

- **UI framework: React.** Component model fits the forms/lists/tables nature of roster, standings, and strategy/lineup screens; held up well through the Franchise Mode UI work (team select, strategy pickers, lineup editor) without needing anything heavier.
- **Bundler/dev server: Vite.** No competing need (no SSR, no exotic build target) — instant HMR and zero-config TS.
- **Linting: oxlint**, not ESLint — the current `create-vite` template default. A Rust-based linter, notably fast; a custom `no-restricted-imports` rule enforces that `engine/` never imports React or anything from `ui/`.
- **Testing: Vitest**, focused on the sim engine — possession-resolution math, usage weighting, bench rotation/fatigue, schedule generation, season rollover. UI/data-CRUD code (screens, the `LeagueContext` orchestration layer) stays lightly tested, verified manually in-browser instead — silent distribution bugs in the *engine* are otherwise invisible until stats look "off" many games later, which is a materially worse failure mode than a UI bug.
- **Folder structure: split by layer, not by feature** — holds up as the codebase has grown:
    - `engine/` — pure TS, no UI/React dependencies. `possession/` (play-call selection, player/matchup selection, strength/resistance, outcome resolution), `rotation/` (fatigue, substitution), `season/` (aging, rollover building blocks), `generator/` (random player/team/league creation), `schedule/` (round-robin scheduling, standings), plus shared `matchup.ts` (position/defender-fit helpers used by both possession resolution and substitution logic) and `constants.ts` (every tunable weight, named and commented, in one place).
    - `data/` — `types/` (split by domain: player, team, league, game, season, common), `persistence/` (storage adapter + repository), `presets.ts`, `ids.ts`.
    - `ui/` — `screens/`, `components/`, `state/` (the `LeagueContext` provider and its actions).
    - `simcast/` — still just a placeholder, per plan.

---

## 12. Franchise Mode — ✅ v1 shipped

Lets a GM take control of a single team in the league — set its strategy, manage its lineup, and keep playing that team across multiple seasons — rather than only ever generating and simming one season at a time. This is the point where "create a league, sim a season, see standings" (the MVP loop) became an ongoing thing a player actually follows, per the doc's original Builder/GM and Storyteller core pillars (Section 1).

### 12.1 Scope breakdown

| Piece | Status |
|---|---|
| Team control | ✅ Shipped — a Team Select screen after league generation, chosen once, marks `League.userControlledTeamId` |
| Own strategy | ✅ Shipped — offense/defense dropdowns on a My Team screen, auto-applied |
| Own lineup | ✅ Shipped — starting-five checkboxes + per-player target-minutes inputs on the same screen, gated on exactly 5 starters selected |
| Season progression | ✅ Shipped — a "Start Next Season" action once the schedule is fully played |
| Narrative/history | ✅ Shipped, minimally — a `SeasonSummary` (final standings) per completed season, shown stacked on the Standings screen, newest first |
| Leave and start fresh | ✅ Shipped — "New League" (now behind a confirmation, since it discards a configured franchise, not just a random one) |

### 12.2 v1 scope decisions (still current limitations)

- **No draft or free agency.** Season rollover ages every player up a year and regenerates a fresh schedule for the *same* rosters — no new prospects enter the league, no players leave. Attributes are frozen; only `age` and the derived `ageCurveStage` label change (the Development System that would age attributes doesn't exist yet — Section 3). A roster that ages indefinitely with no turnover is the accepted v1 limitation.
- **No playoffs.** Consistent with Section 11.4's MVP decision — the season's narrative comes from the standings race and year-over-year team trajectory, not a bracket.
- **No retirement/roster attrition**, for the same reason as no-draft — nothing yet removes an aged-out player from a roster.
- These three are the load-bearing gaps between "a season loop that works" and "a real franchise mode" — see Section 14 for how they're prioritized.

### 12.3 What shipped, mechanically

- **Team selection** happens once, right after generation — team names/rosters aren't known until `generateLeague()` runs, so it can't happen earlier. Not re-selectable later; changing teams mid-franchise is a different, unbuilt concept.
- **The lineup editor has no position-coverage requirement** — the engine doesn't need one (on-court matchups are computed by sorting the five by position, not by requiring specific slots filled), so it's genuinely "pick any 5 distinct roster players." The one hard requirement is exactly 5, enforced by the save button staying disabled otherwise.
- **Season rollover** discards the completed season's `Game` objects (and their possession logs) entirely, keeping only the compact `SeasonSummary` — the real implementation of Section 6's rolling-window policy.
- Old saves from before a given Franchise field existed just don't load cleanly (routes back to setup) — accepted per Section 11.2's no-migration posture, with light display-only fallbacks (e.g. defaulting a missing season number to 1) added only where a stale value would otherwise be a visibly broken label, not as a general pattern.

---

## 13. Bench Rotation & Fatigue System — ✅ v1 shipped

Not in the original build order at all — added post-MVP once the core loop was working and it became obvious that a fixed five playing every possession of every game was the biggest thing standing between "a simulation" and "a basketball game." Confirms Section 2.1's original instinct that fatigue should be ephemeral, in-game-only state: that's exactly how it shipped.

### 13.1 What drives a substitution

Three ingredients, working together rather than as separate mechanisms:

- **Fatigue** — rises while a player is on the floor, recovers while benched, both rates modulated by Durability (Section 2.1's newly-dual-purpose hidden trait). Roughly an 18-possession shift before a neutral-Durability player is fatigue-eligible for a sub, and roughly 10 possessions of rest to recover — both numbers tunable constants, not hardcoded.
- **Target minutes** — every rostered player has a target-minutes share (auto-generated by depth-chart rank at team creation, GM-editable for the Franchise team via Section 12). Running significantly ahead of that pace triggers a substitution even before a player is fully fatigued — this is what gives bench players (not just starters) realistic, bounded shifts.
- **Matchup fit** — *who* comes in isn't just "the most-rested eligible player." A bench candidate's raw attribute quality is blended with how well they'd defend whichever opponent they'd be matched up against, reusing the same defender-fit math that already existed for in-possession matchup assignment (Section 5.5). Substitution decisions are deterministic, not randomized — coaching decisions are structural, matching how defender assignment already worked, not usage, which is intentionally randomized (5.5.1).

### 13.2 Known v1 limitation

In a 3-deep position group (most groups are 2-deep, from the roster generator's template), the third player only sees the floor opportunistically — when both players above them are simultaneously unavailable — not on any guaranteed schedule. Fixing this would mean weighing a candidate's own pace deficit in *who* gets picked, not just *when* a sub happens — a reasonable v1.1 tweak, not required for the core loop to feel real.

### 13.3 Consequences elsewhere

- `PlayerBoxScoreLine` gained a `minutesPlayed` field, and box scores now naturally show however many players actually saw the floor (typically 9–11 of a 12-man roster in a game), not a fixed 5.
- The possession log gained `homeOnCourtIds`/`awayOnCourtIds` per entry (Section 2.4) — once the on-court five could change mid-game, rebound attribution and minutes both needed to know who was actually on the floor for *that specific possession*, not just at tip-off.

---

## 14. What's Next

### 14.1 Differentiation thesis

The genre's incumbents (Basketball GM and its cousins) mostly persist a box score and not much else — outcomes without the reasoning behind them, and no narrative layer beyond static news blurbs, despite "Storyteller" being one of this game's three core fantasies (Section 1). This game's possession log already carries far more than a final number: play call, matchup, fatigue state, clutch context, all per possession. That's a structural advantage the incumbents don't have, and it's the throughline behind four new roadmap items (marked ★ below) that don't add a new simulation system so much as **spend data that's already being collected**:

- **★ Broadcast Commentary** — templated play-by-play text generated directly from existing possession log fields (play call, players, outcome). No new data needed. Also functions as a cheap proof-of-concept for whether the possession log narrates well *before* investing in full Simcast rendering (Section 7) — a natural precursor, not a detour.
- **★ Coaching Insights** — turns the sim's own (already-transparent) math into feedback for the GM: "Switch-Everything got exploited tonight — your backup center was cross-matched onto their point guard four times in the fourth." Direct payoff for the Mastermind Coach pillar (Section 1), and only possible because outcomes here are attributable by construction, unlike a black-box sim.
- **★ Narrative Engine** — data-mined storylines (breakout seasons, rivalries, clutch legends) instead of hand-authored ones, using exactly the kind of granular log this game already has and most competitors don't. Directly serves the Storyteller pillar, which currently has no payoff anywhere in the game.
- **★ Shareable Highlights** — a highlight or storyline blurb a player can export/share. No backend needed (consistent with Section 11.2's local-only architecture) — the "show this off" value the genre's incumbents don't offer without going social/multiplayer.

Items 1-7 below were sequenced purely by this differentiation thesis. From item 8 onward, the driving lens shifts to **release readiness** — what a promoted, publicly-playable version of this game needs that it doesn't have yet — which reorders some of these differentiation items (Narrative Engine, Shareable Highlights) behind genre-pillar systems (Draft, Retirement, Playoffs) that a real release can't credibly ship without.

### 14.2 Unified roadmap

One sequence, merging the system-level roadmap with the differentiation items above and the smaller near-term items — ordered by dependency and by front-loading cheap, high-visibility wins between the larger builds:

1. ✅ ~~Lineup screen: full player attributes~~ — shipped (Section 12.3's My Team screen now shows all 10 core attributes + overall rating alongside starter/minutes controls).
2. ✅ ~~Overtime rules~~ — shipped (Section 5.5.2). Mirrors real NBA rules: 5-minute extra periods at regulation pace, a neutral jump ball opening each one, no cap on how many can happen. `standings.ts`'s old tie-break hack is no longer live code (a tie should never reach it now), kept only as a defensive fallback for hand-fed test data.
3. ✅ ~~★ Broadcast Commentary~~ — shipped (Section 6.1). Cheap, standalone, and gives an immediate "this feels alive" upgrade over a plain box score, verified reading naturally through overtime too.
4. ✅ ~~Live Play-by-Play Simulation View~~ — shipped (Section 6.2). Reveals Broadcast Commentary possession-by-possession instead of all at once, via a generator-based refactor of `simulateGame` that's the actual foundation for in-game coaching decisions below, not just a UI animation.
5. ✅ ~~★ Coaching Insights (v1 slice)~~ — shipped (Section 6.3). Reads weak-link matchup targeting and fatigue-driven subs, both reconstructed from the possession log with no engine changes. Gets a second pass once Synergy/Morale (below) adds fit-based reasoning to explain from.
6. **In-game coaching decisions (timeouts, substitutions, matchup changes, offense/defense emphasis).** The actual interactivity the Live Playback view (6.2) was built to support — teaching `simulateGameSteps`'s yield point to accept a directive via `.next(directive)`. Deliberately scoped as its own design pass per item, not bundled into 6.2.
7. ✅ ~~Development System (Section 3)~~ — shipped. Franchise Mode's aging (Section 12/13) now means something beyond a cosmetic age-curve label: DP earning, Training Focus, and season-end growth/decay are all live, gated on nothing from Section 4 (which stays the trigger for the fuller Practice Allocation/Coaching Staff scope described in Section 3).
**From here, items are grouped into release-readiness phases (14.4) rather than one flat numbered list** — see below for the full phase breakdown and the reasoning behind the reordering.

### 14.3 Unscoped

Set plays, reactive AI, and situational strategy overrides remain acknowledged v2+ ideas without a firm place in the queue yet — revisit once 14.4 lands. (Free agency graduated out of this list — it now has a firm place, Phase 2 below.)

### 14.4 Path to Release

Prompted by an explicit stock-take: the simulation/franchise-management *engine* is strong, but a promotable release needs things the engine alone doesn't provide — roster turnover (draft/retirement/trades), a season that ends in a bracket, and enough production polish/data safety to hand this to strangers. This phase list supersedes items 8-15 of Section 14.2 above (the still-unshipped ones are folded in here, reordered) and adds several near-term feature requests that surfaced during actual play.

**Phase 0 — Quick wins — ✅ shipped.** Cheap, isolated, immediate payoff; good to knock out while bigger phases are being designed.
- ✅ ~~**W/L badges on Schedule rows for the user's team**~~ — a one-glance "how am I doing" signal; `GameListItem.tsx` already bolds the user's team name, this is the same spirit. Derived straight from each game's own score vs. `userTeamId` (`resultBadge` in `GameListItem.tsx`), not `Team.record` — that field turned out to be dead (set at generation, never updated; `computeStandings` already derives wins/losses from games directly, same pattern reused here).
- ✅ ~~**Average Overall slider (League Setup)**~~ — a parity/difficulty knob at league generation (−15 to +15), shifting the mean of the attribute-roll distribution. Threads as a single additive offset composed with each attribute's existing position bias (`generatePlayer(position, rng, shift)` in `randomPlayer.ts`, forwarded through `generateTeam`/`generateLeague`) — no new roll logic needed. The 5% standout-roll branch deliberately ignores the shift, same as it already ignores position bias.
- ✅ ~~**Pace slider (League Setup)**~~, 90-105 possessions/game — this *is* "make per-game possessions more realistic," just exposed as a user-facing control with a well-researched default and range. `generateLeague`'s `possessionsPerGame` param already existed end-to-end; the only missing wire was `LeagueSetupScreen` never passing a custom value through.

**Phase 1 — Foundation refresh — ✅ shipped.** Not user-facing wins by themselves, but each makes a Phase 2 system meaningfully better, so they went first.
- ✅ ~~**Upgraded attribute generation**~~ — shipped. Rescaled to a 2K-style read: `ATTRIBUTE_FLOOR`/`ATTRIBUTE_CEILING` = 40/99, baseline roll re-centered so the mean lands at ~70 ("decent" NBA level), 80+ reads as good-great, 90+ as elite (the existing 5% standout-roll mechanic, unchanged, now layers cleanly on top). Verified safe for simulation balance before shipping: every possession-resolution formula compares attribute-derived quantities *differentially* (never against a fixed threshold), so a uniform population shift cancels out — confirmed empirically post-ship too, a full season's scores/competitiveness look identical in character to before. `DECLINE_FLOOR_ATTRIBUTE_VALUE` was retired in favor of reusing `ATTRIBUTE_FLOOR`, so generation, growth, and decay all agree on one universal minimum.
- ✅ ~~**Player Info Pages**~~ — shipped. Dedicated per-player screen (identity, attributes, development/potential, intangibles, season averages), reached via clickable player names on My Team and Development. New `aggregateSeasonTotals` (`engine/boxScore.ts`) gives per-player season stat lines for the first time — a genuinely new capability, not just a display of data that already existed elsewhere, and one Draft/Free Agency scouting (Phase 2) will reuse.
- ✅ ~~**Realistic schedule (rest days)**~~ — shipped. `generateSchedule` used to map round-robin round `i` straight to `startDate + i` days, so every team played every single calendar day of the season. Round-to-round gaps are now a weighted 1-3 days (15% back-to-back, 65% normal rest, 20% extra day off — ~2.05 days/round average, closely matching the real NBA's ~2.07 days/game pace), giving the whole league a realistic mix of rest days and occasional back-to-backs at the round (whole-league) granularity the generator already operates at. Purely a calendar-realism change — fatigue remains ephemeral, per-game-only state (Section 13), so a back-to-back has no performance effect on players yet.

**Phase 1.5 — Save schema versioning/migration — ✅ shipped.** Deliberately inserted *before* Phase 2, not after: Draft, Retirement, and Free Agency are all going to touch the `Player`/`Team` schema again (draft rights, contract-ish fields, transaction history), the same kind of change that's already required a full localStorage wipe twice this project (Live Playback's `PossessionLogEntry` additions, Development's `potential` scalar-to-map change). A 5th `hoopsim:schemaVersion` localStorage key now tags every save; `loadLeagueBundle` (`data/persistence/repository.ts`) runs any registered migrations (`data/persistence/migrations.ts`'s `MIGRATIONS` registry, currently empty — version 1 is the starting point) to bring an older save forward, then re-persists the upgraded shape so future loads skip re-migrating. Explicitly not a retroactive fix for saves already broken by this session's earlier schema changes (there's no way to know which of several prior shapes an existing unversioned save is in) — what it guarantees is that any load that can't be handled safely fails gracefully to "no save found" (already routes to League Setup) instead of crashing, and every schema change from here forward gets a real, working migration instead of requiring a manual wipe.

**Phase 2 — Core genre pillars.** The biggest gap between "a good simulation" and "a real management game": rosters currently age forever with no one ever entering or leaving the league.
- **Draft** — rookie generation + draft order + draft-day flow. The reason to ever be bad on purpose (tanking/rebuilding), and the payoff for Phase 1's attribute-generation work.
- **Retirement** — the exit half of roster turnover; today decline has a floor (Section 3) but no endpoint, so a roster can end up carrying a 55-year-old bench player indefinitely.
- **Free Agency / Trades** — some real transaction system. Today the only roster lever a GM has is strategy/lineup/rotation settings on a fixed 12-16 players forever.
- **Playoffs (Section 12.2)** — a season that ends at final standings with no bracket has no "win it all" moment, usually the actual goal a management-game player is chasing. Also the richest narrative-generation moment in the game once the Narrative Engine (Phase 5) exists.

**Phase 3 — Remaining product hygiene.**
- **Save export/import** — portability and backup, now that everything lives in one browser's localStorage with no recovery path if it's cleared.
- **Onboarding** — the game now has real systems (DP/Training Focus, rotation minutes, strategy schemes, Coaching Insights) with zero introduction for a first-time player.

**Phase 4 — Promotion polish.**
- **Visual/UI design pass** — today's functional HTML tables and team-color swatches work but don't screenshot or market well.
- **Simcast (Section 7) or a lighter visual hook** — still de-risked by Broadcast Commentary having already proven the possession log narrates well, per Section 8's original sequencing rationale, but a text-only sim is a much harder sell in a marketing screenshot than a court view, even a simple one.
- **Balance validation via extended simulated playtesting** — nothing's been stress-tested past a season or two (does DP snowball for rich-get-richer teams, does any strategy dominate, does overtime frequency feel right over dozens of seasons).

**Phase 5 — Depth & differentiation.** Real, valuable systems — genuinely not release-blocking, since none of them are why a reviewer would call the game unfinished.
- **★ Narrative Engine v1** — breakout-season detection, rivalry detection, clutch-legend tagging, mined from data Development/season-history already persist. Slotted after Draft/Retirement now (not before, as originally sequenced in 14.2) so rookie-debut and farewell-tour storylines have real events to hang on.
- **In-game coaching decisions** (timeouts, substitutions, matchup changes, offense/defense emphasis) — the interactivity Live Playback (6.2) was built to support, via `simulateGameSteps`'s yield point accepting a directive through `.next(directive)`.
- **Synergy & Morale (Section 4)** — fit/miscast consequences now have somewhere real to land, given strategy is user-assignable and rosters persist across seasons.
- **Custom Strategy Editor (Section 5.6)** — natural follow-up to the preset picker, once there's more than 4 presets' worth of reason to want one.
- **Nuanced scoring attributes** (dunk/layup vs. post scoring; iso-created vs. catch-and-shoot) — a real change to the locked 10-attribute model (Section 2.1), needing the same kind of design pass Section 9 already gave a rejected Strength-attribute split.
- **★ Shareable Highlights** — by this point (post-Narrative-Engine, post-Playoffs) there's something genuinely worth sharing, not just a raw box score.
