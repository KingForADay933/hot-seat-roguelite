**Project:** Hot Seat (roguelite spinoff of Hoop Sim)
**Repo:** [KingForADay933/hot-seat-roguelite](https://github.com/KingForADay933/hot-seat-roguelite) (private)
**Companion doc:** [[Roguelite-Basketball-GM-Design-Document]] -- vision, rationale, open questions. This doc is the flat feature/status catalog; that one is the "why."
**Parent-project doc:** `Basketball Manager Game - Design Document.md` -- Hoop Sim's own design doc, which owns everything in `engine/`. Tier 0 is a port of what it describes.
**Deep dives:** `rotation-charts.md` (Tier 7.6) covers the clock rewrite and lineup control in detail. `detailed-simcast.md` (Tier 7.7) is the planning doc for the labeled-court-view simcast, not yet built. `m3-tactical-axis.md` is the build plan for the M3 milestone -- order, decisions, and the measurements behind them.

### Reading the "Section N" citations in code

Roughly forty files cite bare section numbers, and **two different documents are being cited with
overlapping numbering**. Which one a citation means is decided by the layer the file sits in:

| Citation appears in | Document | Examples |
| --- | --- | --- |
| `engine/`, `data/types/` | Hoop Sim's design doc | Section 4 = Strategy Synergy & Morale · 5.5 = Possession resolution · 5.5.2 = Overtime · 6 = Possession Log Storage (the rolling window) · 14.2 = the roadmap listing Broadcast Commentary and Live Playback |
| `run/`, `ui/` | The roguelite design doc | Section 2 = Core Loop ("the hard hand on purpose") · 3 = Run Variation · 8.1-8.7 = market size, shop, camps, upgrades, consumables |

Section 3 and Section 4 genuinely mean different things depending on the file — Hoop Sim's Section 3
is the Development System, the roguelite's is Run Variation. Worth knowing before chasing a
reference into the wrong document.

**One citation still doesn't resolve:** several `run/` files cite "Section 9" for season chunking
(`run/constants.ts`, `run/types.ts`, `runState.ts`, `App.tsx`). The roguelite doc in this repo stops
at Section 8, and Hoop Sim's Section 9 is its parking lot. The roguelite doc here is therefore an
earlier revision -- it also still describes persistence as localStorage, which Tier 0 superseded. A
newer revision with a Section 9 exists somewhere; dropping it in would close the last gap.

Status markers: **Shipped** (built, tested, verified in-browser) / **Planned** (scoped, not yet built) / **Idea** (raised, not yet scoped).

**Tier numbers are stable identifiers, not build order.** They roughly follow the order things were
built, but new work slots in wherever it fits by subject. For what to actually work on next and in
what sequence, see [Build Order](#build-order) below.

---

## Build Order

Sequenced toward an itch.io release, grouped into milestones. Everything not listed here is either
shipped or still an unscoped Idea.

**The organizing principle is strategic axes, not cost.** This is a roguelite, so replayability *is*
the product — a build that's compelling from one angle isn't a smaller version of the game, it's a
different and worse one. So items are ordered by whether they add a way to play the game differently,
not by how cheap they are. That's why defensive stats sit early (a defense-first build is currently
invisible — you can construct one and never see it work), why the cheap half of in-game decisions
outranks playoffs (it's the first thing that makes *how you play a game* differ run to run, where
playoffs add stakes structure but not a playstyle), and why injuries are scheduled rather than parked
(rotation depth and load management become real decisions, which gives the per-position minutes budget
teeth).

Estimates are **focused working days**, not calendar time — multiply by your own availability.
Excluding the completed M1 and M1.5, the milestone rows sum to **86–125 days**: at two solid days a
week that's 10–15 months, at four it's 5–8. (Corrected from a stated 96–138, which did not match the
column it summarised — worth re-adding whenever a milestone moves, since a headline number nobody
checks is how a plan quietly stops being one.)

**That is a real increase and worth reading as one.** The list has roughly doubled since it was first
sequenced, and every addition has been individually justified — which is exactly how a scope grows
past what one person ships. Tiers 18–22 are all genuinely good, and none of them is required for a
run to be complete and fun; M1 already cleared that bar. If the timeline needs to come down, this is
the block to cut from, and the honest order to cut in is 21, 22, 18, 20, 19 — analytics is polish,
rivalries and archetypes are texture on a season structure that has to exist first, mentorship is
tied to a roster problem M5 could ship without, and focus points are the one that adds a way to
*play* differently rather than a way to feel differently.

| Milestone | Contents | Tiers | Days |
| --- | --- | --- | --- |
| **M0 — itch page** | Store copy, screenshots, a simcast GIF. Created as a **draft, not published**. Copy drafted in `itch-page-draft.md`. | — | 1 |
| **M1 — Complete run** ✅ | ~~Simcast pacing~~ · ~~chronological game order~~ · ~~rebounds in-sim + defensive stats~~ · ~~run-end summary~~ — **complete** | 7.5, 1.5, 11, 8 | 10–14 |
| **M1.5 — Pre-playtest legibility** ✅ | ~~Coaching Insights after every game~~ · ~~team records in the schedule~~ · ~~standings comprehension~~ · ~~weight rebounds toward bigs~~ — **complete** | 16, 11 | 2–4 |
| **M2 — First playtest** | Share privately with 3–5 people; first real difficulty pass; sets the price/scarcity targets for M5 | 1, 15 | 3–5 + ongoing |
| **M3 — Tactical axis** | Planned in detail in `m3-tactical-axis.md`, four design decisions settled. ~~Position-fit retune~~ ✅ · ~~opponent scouting~~ ✅ · ~~tactical focus points~~ ✅ (which *are* Tier 13 level 2, not a separate item) · more team-construction options | 7.6, 17, **19** + 13, 3 | 14–20 |
| **M4 — Season arc** | League structure & conferences · playoffs bracket · graduated expectations · **owner archetypes** · **nemesis teams** · richer Coaching Insights | 12, 16, **18**, **22** | 19–28 |
| **M5 — Roster turnover** | Injuries · foul trouble · retirement, backfill & poaching · shop-based signings · **veteran mentorship** · run-configuration toggles | 14, 15, 12, **20** | 24–36 |
| **M6 — Live coaching** | In-game decisions tiers 3–4 (substitutions, matchups, timeouts) | 13 | 15–20 |
| **M7 — Launch prep** | Paint mode · **analytics suite** · more descriptive cards (from M2 notes; compact screens + first broadcast pass shipped early) · polish · page finalization and publish | 7.6, **21**, 16, 10 | 10–15 |

### Why this shape

- **M0 is a forcing function, not a launch.** Writing the store copy is the cheapest scope test there
  is: if the pitch reads well against M1's feature set, everything after M1 is a deliberate choice to
  make the game better rather than a debt being paid off. If it doesn't read well, that's worth
  knowing in week two rather than month six. itch pages can sit unpublished or behind a restricted
  link indefinitely, so this costs no exposure. **Already paid off once:** the first draft
  (`itch-page-draft.md`) surfaced that the pitch has no summit — there's no way to write "make the
  playoffs" or "win a title" today, and "finish top half" is a materially weaker hook. That's a
  sharper argument for Tier 12 than the one it was originally scheduled on.
- **M1 was "a run that feels finished," and it's done.** The run-end summary was the highest
  value-per-hour item on the list and had been buried at Tier 8 — the design doc's own pillars call
  the ending "the emotional payoff," and the run just stopped. Worth recording how the estimate
  moved: it was scheduled on the assumption that Coaching Insights could be re-aimed at a run, but
  possession logs don't survive the chunk that produced them, so the summary is built by replaying
  the run's own state machine over retained standings instead. Different mechanism, same milestone,
  and a better fit — see Tier 8.
- **M2 comes before the big features on purpose.** The "too forgiving" difficulty problem is the one
  thing that genuinely can't be solved alone — you know where the seams are and playtesters don't.
  Doing it after M1 means the balance data arrives before three more milestones get tuned on top of
  wrong numbers. No public posting required; a private link to a few people is enough.
- **M2 sets the numbers M5 is built against.** Shop-based signings (Tier 15) are the one mechanic
  that could deflate the core tension rather than deepen it — if a purchase reliably fixes a bad
  roster, "how long can I survive" becomes "how fast can I fix it." The playtest is the right input
  for how expensive and how rare that purchase should be, and for how hard injuries can hit.
- **M5 is one axis, not five features — and it's the largest milestone deliberately.** Injuries,
  foul-outs and retirement are mechanically the same event (a player becomes unavailable against your
  wishes), and shop signings are the other half of that same balance problem: attrition sets how often
  you need a replacement, acquisition sets what one costs. Tuning any of it in isolation means tuning
  it twice. Run-configuration toggles come along because "injuries on/off" can't ship before injuries
  do. Tier 12 therefore spans M4 and M5, and Tiers 14 and 15 overlap inside it — milestones and tiers
  are orthogonal. If it has to be split for scheduling, the seam is between losing players and buying
  them, but expect to retune once the second half lands.
- **M6 is still the item most likely to slip, but less than it looked.** The determinism problem —
  how a live GM decision reaches a pure, seed-deterministic simulation that also runs headless
  AI-vs-AI games — turns out to have a designed answer in Hoop Sim's own doc: pass directives in
  through the generator's `.next()`, so they're inputs rather than mutations. See Tier 13. What's
  left is defining what a substitution directive does to `RotationState` mid-period, plus real
  mid-broadcast UI, so the estimate stands even though the architectural risk doesn't. Still
  deliberately last, so everything underneath it has stopped moving — and still a stronger
  post-launch update than a launch bullet nobody knew to expect, if it comes to that.

### Hard constraints inside the order

These aren't preferences; the work breaks if they're ignored.

- **The two Tier 11 items ship together.** Both change `PossessionLogEntry`, and `isValidBundleShape`
  rejects mismatched saves rather than migrating them — deliberately, because nothing has shipped.
  That's still true, so one save-break covers both. Later, it costs a migration system or real runs.
- **Position-fit tuning must follow Tier 11.** Defensive stats change the outcome model and will move
  scoring; tuning before that is work you'd redo. Hence M3, not M1.
- **Chronological game order must precede in-game decisions.** Carrying fatigue, injuries or live
  coaching state between games is incoherent if games can be played out of order. Hence M1, not later.
- **Conferences precede the playoff bracket.** They're the natural seeding basis, so decide the league
  shape once.
- **Detailed Simcast must never generate a possession's choreography ahead of the render cursor.**
  `simulateGameSteps` stays a lazy, one-possession-at-a-time generator specifically so Tier 13 can feed
  it a directive between possessions; a lookahead buffer built for smoother court-view animation would
  quietly break that. See `detailed-simcast.md` §1.

---

## Tier 0 — Core Simulation (ported from Hoop Sim)
**Shipped -- Phase 0**

Everything Hoop Sim already had, carried over into the roguelite repo unmodified:

- Player / Team / League generator
- Possession-log-driven fast-sim engine (play calls, matchups, fatigue/rotation, box scores)
- Broadcast commentary
- Coaching Insights -- dormant at first (ported over but never actually called from this game mode); wired up for real in Tier 1.5, where it drives the mid-season checkpoint screen
- Player development (season-end growth/decay toward potential, aging)
- Schedule generation + standings
- IndexedDB persistence via a swappable storage-adapter pattern -- swapped in from an initial localStorage implementation once a season's saved payload started exceeding localStorage's ~5MB per-origin quota (a hard Chromium/Blink limit that wrapping the app in Electron doesn't change, since Electron embeds the same storage engine)
- **Shipped -- roster talent structure**: every attribute used to roll independently, so `overallRating` (the mean of ten of them) had its spread crushed by the central limit theorem to a standard deviation of **3.53** on a 0-100 scale. Measured over 400 leagues: mean 71.5, only 0.30% of players at 82+, nobody ever reaching 90. Since Tier 2 hands the GM the league's worst roster on purpose, the roster actually played had 77.3% of its starters under 75 -- a lost cause by the 2K standard this was retuned against, and "worst team" barely meant anything when the whole league sat within a few points of average. The same absence of any per-player quality signal made the depth chart pure noise: a doubled-up position benched its second-best above some other position's starter on **86.8%** of teams. `ROSTER_TALENT_LADDER` (`engine/constants.ts`) fixes both with one mechanism: an additive per-depth-rung offset applied to all ten attributes at once (rungs 0-4 land on five distinct positions, so the existing best-overall-at-each-position starter selection just picks the five best players with no logic change), plus a per-team `TEAM_TALENT_SPREAD` draw so the league has real contenders and cellar-dwellers rather than eight interchangeable rosters. Measured before -> after: bench-outranks-a-starter 86.8% -> 14.6% of teams (by 3+: 58.3% -> 5.1%), league mean/sd 71.5/3.53 -> 74.0/7.39, teams with an 82+ 3.7% -> 95.4%, teams with a 90+ 0.0% -> 11.1%, your own roster's starters under 75 dropped 77.3% -> 16.6%. Calibration held: scoring 111.0 -> 114.0 a team, 2PT% 55.8 -> 56.7, 3PT% 34.6 -> 34.7, free throws 74.5% -> 78.6% (the one term that doesn't cancel under a uniform lift, and the value that moved toward the real league's ~78%). `engine/depthChart.ts` extracts the starting-five/rotation-minutes derivation so generation and the post-quirk path (which previously had no owner at all -- `applyRosterQuirk` returned reshaped players while `startingFive` stayed whatever generation had picked) share one implementation. `run/franchisePlayer.ts` guarantees the GM's own roster one player at 82 -- a floor, not a set, lifting a starter rather than the roster best so it can't reintroduce the depth-chart problem, applied after the quirk so a tilt can't knock the guaranteed star back under. **Knock-on retune:** `POSITIONLESS_ATTRIBUTE_SPREAD_MAX` (Tier 7.6) dropped 26 -> 24, since raising the league's ratings compresses measured attribute spread from the top and had pushed Positionless to 31% at some positions.

---

## Tier 1 — Run Structure
**Shipped -- Phase 1**

The core roguelite loop wrapped around Tier 0's engine:

- A run = a sequence of seasons in stretches. Each stretch gives a window of seasons (window length is now market-size-dependent, see Tier 3) to hit a target.
- Target = finish within a rank fraction of standings (starts top-50%, tightens 10 points per successful stretch, floors at top-10%).
- Hit the target → stretch escalates immediately (harder target, season count resets). Miss on the stretch's last chance → fired, run ends.
- `simulateRunSeason` (superseded by Tier 1.5's `simulateSeasonChunk`): one call plays a full headless season (schedule, every game, standings, development) and folds the result into the target/fired state machine. A run is fully playable with zero UI.
- Shortened season length (32 games vs. Hoop Sim's 82) for the ~5-10 minute session target.
- **Planned -- scheduled M2** -- overall variance/difficulty currently reads as too forgiving in playtesting; tighten it (steeper stretch escalation, tighter attribute-shift/wildcard rolls, less snowball-friendly economy). See design doc Section 7 -- expected to matter even more once the playoffs/championship-expectations win-condition lands (now Tier 12, M4), since that adds its own variance on top of this rather than replacing it. Scheduled at M2, deliberately *before* that: this is the one problem that can't be solved alone, and tuning it early means the later milestones aren't balanced on top of wrong numbers.

---

## Tier 1.5 — Season Chunking
**Shipped**

Not part of the original phase plan -- came out of fixing the localStorage-quota bug (see Tier 0) and a design pass on "let the player react mid-season, not just between seasons." Splits a season into checkpoints instead of one atomic sim:

- A season's games split into 4 chunks (checkpoints after games 8/16/24, then the real season end after 32).
- After each non-final chunk, a checkpoint screen surfaces that stretch's Coaching Insights (Tier 0's engine feature, wired up here for the first time), filtered to the user's own team and deduplicated so a routine substitution pattern repeating across several games doesn't spam the list.
- In response, the GM can adjust rotation minutes and training focus per player before the next chunk plays -- `Team.rotationMinutes` / `trainingFocus` fields that existed since Tier 0 but weren't GM-editable until now. Small, reactive tweaks, not a full lineup rebuild each checkpoint.
- The season's final chunk still runs the same once-per-season pipeline as before chunking existed (standings, target evaluation, budget, development, league bookkeeping) and lands on the unchanged Season Results screen.
- Possession logs are discarded immediately after a chunk's insights are pulled from them -- nothing downstream (standings, development) needs possession-level detail, only the box score. This is what actually shrinks a season's saved payload (down to well under 1MB), independent of and in addition to the IndexedDB switch.
- **Idea, unscoped** -- one-time-use per-chunk power-ups (i.e. Tier 7's Consumables, but used at chunk cadence instead of pre-season) were considered as the checkpoint decision and explicitly parked for later. Flagged as especially useful for late-season clutch situations.
- **Shipped -- chronological game order** (M1): a season is played in order. `StretchScreen` used to offer Sim and Watch on every game in the chunk at once, so a GM could resolve game 5 before game 2 or cherry-pick around a hard opponent. Only the earliest unplayed game of the run team's own is resolvable now; the rest render their controls disabled, so the schedule stays readable and the affordance stays visible rather than the rows looking inert. Kept as one derived function (`run/seasonChunks.ts`'s `nextPlayableGameId`) rather than a stored cursor -- nothing to keep in sync, and a save from before the rule, where a later game may already be played, resolves to whatever is earliest and unplayed rather than getting stuck. Enforced in `RunProvider` as well as in the UI so the invariant belongs to the state layer, not to a `disabled` attribute; deliberately *not* applied to `commitLiveGame`, since refusing to record a game the GM has already watched would lose real play rather than prevent anything. Worth having done early: fatigue, injuries and in-game coaching decisions all carry between games, and none of it means anything if the order is arbitrary.

---

## Tier 2 — Playable Loop / UI Shell
**Shipped -- Phase 2**

- Screens: Start → Team Reveal → Season Results (loops) → Fired → back to Start.
- The player is always handed the league's worst team by average roster rating -- no team selection, "the hard hand on purpose."
- Full state persists across page reloads (single-blob save, versioned/rejected on schema mismatch rather than crashing).
- **Shipped** -- every screen listing a full roster (Team Reveal, Season Results, the Tier 1.5 checkpoint rotation table) visually separates Starting Five from Bench into their own labeled tables instead of intertwining them.
- **Shipped** -- **My Team**, an always-available reference sheet reachable from every screen of a live run: roster with per-attribute ratings and remaining headroom to potential, scouting (the hidden ratings the sim reads), owned coaching upgrades, held/active consumables, and the run's modifiers in one place. Rotation minutes, training focus and the rotation chart (Tier 7.6) are all editable here at any time, so the Tier 1.5 checkpoint is now a prompt to reconsider them rather than the only place they can be set.
- **Shipped** -- **Abandon Run**, so a GM can end a run deliberately instead of only being fired out of one.

---

## Tier 3 — Run Variation: Imposed
**Shipped -- Phases 3 & 5**

Things that happen *to* the player, no choice involved -- the hot-seat pressure:

- **Roster quirks** (one per run), 9 total, spread deliberately across four axes so the two cards a GM is offered rarely say the same thing twice:
  - *Positional shape*: Stacked at Guard, Frontcourt Overload. Mirror images -- +12 to one end of the position order, -12 to the other, with SF as the hinge. Net-neutral, so a tilt is a different team to coach rather than a harder one.
  - *Skill shape*: Live by the Three (shooting for finishing and rim protection), Defense Wins Championships (both defenses for both shots), Undersized and Fast (speed and quickness for the glass, plus 3 inches off every player). All net-zero across the ten attributes, for the same reason.
  - *Age/development shape*: One Aging Superstar, All Prime No Upside (everyone 26-29 and at peak, potential already reached -- frozen in both directions, where Balanced/Low Ceiling leaves the age curve alone and lets veterans decline).
  - *Variance shape*: Balanced/Low Ceiling (safe and capped), High-Variance Roster (the best two get real potential to grow into, the worst two get worse permanently, the middle is untouched).
- **House rules** (one per run), 5 total. Two reshape the roster once at draft time; three are ongoing constraints the run keeps enforcing:
  - Youth Movement (2+ starters ≤22) and Short Bench (roster trimmed to 8) -- one-shot transforms.
  - Minutes Cap (no player above 30 a game) -- bites on *concentration* rather than on the generated defaults, since the depth weights already hand a lone starter about 32. Safe at every position because generated rosters carry two players per position.
  - Deep Bench, Thin Talent -- the roster stays full but the worst four drop to replacement level. The inverse pressure to Short Bench: bodies are available, but leaning on them costs real quality, so resting a starter stops being free.
  - Homegrown Mandate -- the two best players must keep 20 minutes a game. The protected pair is derived from the roster on every read rather than stored, so the rule needed no new field on `RunState`.
  - The last two are enforced in `run/minutesBudget.ts` alongside the per-position budget, so a house rule can only ever *narrow* the window a GM may write, never widen it. `MinutesInput` reads the same window, so the spinner stops exactly where the write would.
- **More team-construction options** (M3) -- **Planned**: extend the quirk pool further. Three were raised; one is already shipped and the other two are genuinely new, which is worth checking before adding any more:
  - *"Great bigs, decent guards"* -- this is **Frontcourt Overload**, shipped. Any future proposal should be checked against the four axes above first; the pool is now large enough that near-duplicates are the likely failure mode, not gaps.
  - *One Random Superstar* (new) -- elevates a **randomly chosen** player rather than the roster's best. Distinct from One Aging Superstar in the way that matters: that one hands you a declining star you already know how to use, this one might hand a 40-minute talent to your third-string center, which is a rotation and chart problem rather than a decline problem. Needs a decision on whether the star's *position* is re-rolled too.
  - *Underdog Squad* (new) -- low current attributes, high potential across the whole roster. The inverse of Balanced/Low Ceiling, and distinct from High-Variance (which widens the two tails and leaves the middle alone) because it moves everyone at once. It is also the one quirk that would genuinely test whether the run length is long enough to develop out of a hole -- worth pairing with a market size that grants patience, and worth watching in M2 for whether it is simply a losing card.
- **Wildcard events** (~30% chance per season): Breakout (young player attribute boost) or Sophomore Slump (attribute dip). Rolled before the season sims, so it actually affects that season's games, and flows through into real player development.
- **Market size** (one per run): Big (1.5x budget, 2 seasons/stretch patience), Mid (1.0x, 3), Small (0.6x, 4). Two independent axes -- cash vs. patience -- so no tier is strictly better.

---

## Tier 4 — Run Variation: Drafted
**Shipped -- Phase 4**

Things the player *chooses*, from a small rolled hand -- the answer to Tier 3's imposed hand:

- Roster quirk: roll 2 candidates, pick 1.
- House rule: roll 2 candidates, pick 1.
- Defensive scheme (see Tier 6): **all 5 offered, no roll**, and **changeable at any point in a run** -- from a checkpoint, from My Team, or live in the middle of a simcast. One persisted value in every case, since a scheme is what the team defaults to defending in rather than a per-game tactic. The live case is the first real user of the generator's interactive-coaching hook: `simulateGameSteps` now accepts a `CoachingDirective` through `next()`, applied from the following possession. Each possession logs the scheme it was actually defended with (`PossessionLogEntry.defenseSchemeId`), so weak-link insights judge a switched game by what was really run rather than by whichever scheme the team happened to end in. Deliberately not a drafted hand -- defence is the standing instruction the GM gives, not one of the run's imposed variation axes, and it was previously the one lever a player could never touch at all. Chosen on the reveal screen beside the offensive system so both are picked with the roster already on screen. Each card carries a roster-fit read rather than a synergy score (`run/variation/defenseDraft.ts`): a scheme reaches the sim as a *shape* -- which defender the offense gets to attack, which actions are resisted, how much ball pressure -- not as a scalar multiplier, so there is no honest single number to show. Every read is computed from the quantity the engine itself consumes, against the likely starting five rather than the whole roster (a liability on the bench cannot be switched onto).
- System (see Tier 6): roll 4 candidates, pick 1. Widened from 3 once the system came to be chosen with the roster already on screen -- a wider hand is more freedom rather than more guesswork, and four cards fill the reveal grid evenly (SYSTEM_DRAFT_SIZE).
- Shared `pickDistinct` draft-pool mechanic and a reusable `DraftOptionCard` UI, both built to be reused by future shop/draft screens (now also powering Tier 7's shop offer cards).

---

## Tier 5 — Economy
**Shipped -- Phase 5**

- **Budget**: a per-run currency, starts at $0.
- Earned every season: wins × $10, scaled by the market multiplier.
- Bonus $150 (also market-scaled) on every stretch-clear.
- Spending shipped in Tier 7.

---

## Tier 6 — Systems & Synergy
**Shipped -- Phase 6**

- 9 offensive systems total: Motion, Iso-Heavy, Balanced, Pace and Space (pre-existing) plus 7 Seconds or Less, Princeton, Triangle, Grit and Grind, Twin Towers (new).
- Each system is a play-call weight profile + a synergy identity (which roster skills it rewards).
- `Team.synergyScore` (dormant since Hoop Sim) is now active: computed from how well the roster (post-quirk, post-house-rule) fits the drafted system's play-call mix, using the same attribute associations the simulation itself reads -- not a parallel invented metric.
- Set at draft time and **recomputed whenever any of its inputs move** -- camps, coaching upgrades, rotation-minutes edits, and rotation-chart edits (Tier 7.6) all route through the same recompute. It is no longer a draft-time-only number; leaving any of those out was what used to make it go stale on screen.
- Weighted by who actually plays, not by a flat roster average: each player's contribution scales with his share of the game, read from the rotation chart where one exists and from `rotationMinutes` for whatever the chart leaves on Auto. So a bench specialist picks up the touches he suits in proportion to his time, and charting the wrong players into a system's key minutes genuinely costs synergy.
- Feeds a small (0.9x-1.1x) multiplier into offense strength. Every AI-controlled opponent stays neutral; only the user's team ever deviates.
- Deliberate anti-synergy is possible by design (e.g. Twin Towers drafted onto a Stacked-at-Guard roster scores low, on purpose) -- a real tension, not a bug to avoid.

---

## Tier 6.5 — Player Roles & Team Specializations
**Idea, unscoped**

Not part of the original phase plan -- extends Tier 6's synergy identity in two directions: down to individual players and up to a named team-wide identity, both synergizing with the drafted system. See design doc Sections 8.11/8.12.

- **Player roles** (idea) -- discrete, visible player-level traits (Great Cutter, Willing Passer, Spot-Up Shooter, Iso Scorer, Shooter off Screens, Clutch Gene, GOAT Potential) that synergize with specific systems, distinct from Tier 6's attribute-fit-only synergy score. Assignment mechanism (generation roll, draft, shop purchase), stacking rules, and mechanical expression (attribute boost vs. play-call weight vs. direct synergyScore contribution) are all open.
- **Team specializations** (idea) -- a named team-wide identity (Ball Movement, Iso-Centric, Great Spacing, Great Off-Ball Movement, Clutch-Time Boost, Morale Boost) that also synergizes with the drafted system, sitting alongside `Team.synergyScore` rather than necessarily replacing it. Acquisition path (emergent from roster roles, stretch-clear reward, shop purchase) not yet decided.
- Naming overlaps flagged for reconciliation: Clutch Gene appears here at player scope *and* as a Tier 7 coaching-upgrade (team scope); Morale Boost overlaps Tier 7's planned Players' Coach upgrade. Needs a design pass to decide if these are the same effect at two scopes or need distinct names.

> **"More nuanced player roles/quirks" is this tier**, not a new one -- worth stating because it is easy to confuse with Tier 3's roster quirks, which shape a whole *roster* at run start. These are per-player and permanent, and the hard part was never the list of names: it is the three open questions above (how a role is assigned, how roles stack, and what a role actually *does* mechanically). A larger list of names doesn't move any of them. **Decide the mechanical expression first** -- an attribute boost, a play-call weight, or a direct synergy contribution are three different features wearing the same word, and only the second two make a role feel different from a good attribute.
>
> The natural bridge from what exists: `ui/playerTags.ts` already derives display-only tags (Shoot-First, Positionless, Specialist) from attributes and height. Roles are the same idea made *causal* rather than descriptive, which suggests starting by making one existing tag mechanical rather than inventing seven new ones.

---

## Tier 7 — Shop & Spending
**Shipped -- Phases 7-9**

Spends the Budget that's been accruing since Tier 5.

- **The shop** (Phase 7) -- **Shipped**: a tier grants *purchase power* per visit, not a curated player list -- condensed tier (every season) allows 1 single-player camp buy; expanded tier (stretch-clear) allows 3 player-camp buys plus 1 whole-team-camp buy. The GM can send **any** active roster player to camp, not a rolled subset -- see design doc Section 8.4. Rerolls returned with Phases 8-9 as predicted: camps have none (nothing to reroll once player choice is free), while coaching upgrades and consumables each get their own independent free reroll on the expanded tier, since those stay randomly rolled.
- **Camps** (Phase 7) -- **Shipped**: pay to send a player (or the whole team, pricier, smaller boost per player) to camp for a bounded-random-*magnitude* boost to a GM-*chosen* attribute -- not a rolled chance at whatever the game decides is optimal. Same bounded-shift mechanic as Tier 3's wildcard breakout, but both *who* and *which attribute* are deliberate choices now (design doc Section 8.5). Also recomputes `Team.synergyScore` from the camp-boosted roster's fit to the drafted system.
- **Coaching upgrades** (Phase 8) -- **Shipped**: a persistent pool of 10 named cards, each a one-time permanent nudge to one rating or attribute the simulation already reads -- the same flat-shift mechanic as roster quirks and wildcard events, just GM-purchased instead of imposed. All nine from the first-pass list built (plus Fan Culture Buy-In, below): Clutch Gene, Iron Man Program, Film Study, Players' Coach, Defensive Coordinator, Steady Hand, Player Development Guru, Bench Mob Mentality, System Guru. One-per-run (the pool is exclusion-filtered by what's already owned when rolling offers), acquired through a rolled-offer-plus-reroll flow. The two synergy-flavored cards (Players' Coach, System Guru) are re-added on top of the roster-fit score every time synergy is recomputed rather than applied as a one-time mutation, so a later camp purchase can't silently erase them.
- **Consumables** (Phase 9) -- **Shipped**: cheap, single-season, held in a 3-slot inventory rather than instantly applied -- a pre-season "loadout" step lets the player burn 0-3 before a season, so hoarding for a do-or-die last chance is a real strategy. All seven from the first-pass list built: Sports Psych Session, Load Management, Film Room Marathon, Energy Drink Sponsorship, Extra Shootaround, Defensive Bootcamp, Lucky Jersey. Duplicates are allowed (an item stash, not a one-per-run pool). Effects are applied to *transient* roster/team copies for the season they're burned on, never mutating persisted state, so there's nothing to revert when the season ends -- the effect stops existing once that season's local copies go out of scope. A per-chunk cadence for these (Tier 1.5, instead of pre-season) was raised and parked as a future add-on.
- **Fan Culture Buy-In** -- **Shipped**: a tenth coaching upgrade, and the first that changes how much money exists rather than how the team plays. A flat per-season raise on budget earnings (`FAN_CULTURE_BUY_IN_SEASON_BONUS`, inside the market multiplier like every other flat term), derived from `run.coachingUpgrades` each time earnings are computed rather than paid out at purchase -- a one-time lump would be both a worse copy of the Energy Drink Sponsorship and the exact shape that made that card a money pump. Flat rather than a percentage on purpose: a percentage pays least in the losing seasons where budget is tightest and most when you are already comfortable, which is a win-more card in a game about being one bad season from the sack.
- **What the run-economy harness found** (`run/runEconomy.harness.test.ts`, skipped by default -- it plays ~60 complete runs and takes minutes). Built to tune the card above, and it corrected two assumptions worth recording:
  - **Runs are long.** 10-14 seasons at mid market, with a $300 upgrade first affordable around season 4. The worry that a card paying back over time would have no runway was simply wrong.
  - **The economy absorbs its income, and the first measurement saying otherwise was wrong.** A buy policy that only bought player camps reported 58% of all earnings going unspent -- but camps are capped per visit, so that was lazy shopping, not a surplus. Spending on upgrades, team camps and consumables too drops unspent to ~5%. Any future economy measurement needs the full policy or it will report a shortage of things to buy that does not exist.
  - **Variance swamps the difference between candidate magnitudes**, so the bonus was left at the value with a clean three-season payback rather than tuned to noise. The one monotonic signal was unspent budget tripling as the bonus rose, which argues for the low end.
- **Idea, unscoped** -- economy numbers throughout Tiers 5 and 7 (per-win earnings, camp/upgrade/consumable prices, the stretch-clear bonus) are first-pass and flagged in code as needing playtesting to tune. Ties into Tier 1's "too forgiving" variance note. **The harness above is now the way to answer these**, which is the first time they have been answerable at all.

---

## Tier 7.5 — Live Playback (Simcast)
**Shipped**

Not part of the original phase plan. Watching a game happen, rather than only reading its result:

- `simulateGameSteps` is a **generator** that yields one possession at a time and computes nothing ahead of the cursor -- the possessions past it genuinely haven't happened yet. That laziness is deliberate, and it's the hook every future in-game decision (Tier 13) will use.
- Simcast screen: live scoreboard and clock, running box score, on-court panel showing each player's slot, and the broadcast commentary feed narrating as it goes. Play/pause, speed multipliers, Skip to Final.
- Games can be simmed instantly or watched call by call, per game, from the stretch screen.
- **Overtime prompt** -- playback pauses at the start of each overtime period with score and clock frozen at the buzzer, so the GM gets a beat to notice it happened. Acknowledge to resume. The Q4 closing five carries over by default, which needed no engine change (rotation state already persisted across periods).
- **Shipped -- slower default pacing** (M1): `BASE_POSSESSION_MS` is now 1500, up from the 450 the clock rewrite (Tier 7.6) had halved it to. Took two passes: restoring the original 900 fixed the arithmetic (the comment above it had claimed "about three minutes" while describing the pre-halving value) but still played faster than anyone actually reads. 1500 was set by feel rather than derived. At a measured ~219 possessions a game, 1x runs about 5m30s.
- **Shipped -- slower speed options**: `PLAYBACK_SPEEDS` is now `[0.5, 0.75, 1, 2, 4, 16]`, ascending so the control row reads slowest-to-fastest. The slow end is deliberately generous -- 1x is meant to be reading speed, and that turned out slower than this screen originally shipped with, so the ladder extends past the default rather than bottoming out at it. Spans ~20 seconds (16x) to ~11 minutes (0.5x) a game. Verified by sampling the live feed in-browser at each step; measured ticks land within 1-2ms of intended.
- **Shipped -- read a player without leaving the broadcast**: watching a game used to be the one place in a run where a player's name wasn't a way to find out about him -- `PlayerName` controls silently degraded to plain text, because the simcast holds its game generator, queued directive and period cursor in refs owned by the screen, and routing to the run's player page would unmount it and destroy the game in progress. The simcast now runs its own `InspectorContext` whose `openPlayer` opens a card *over* the broadcast instead, leaving the screen beneath mounted. Every on-court row and every box-score row is clickable, live and at final; opening pauses the game and closing resumes it only if it was playing when opened (Escape also closes). The card shows tonight's line and current fatigue -- both things the run's `PlayerScreen` structurally can't, since its season totals come from committed games (this one isn't committed until the buzzer) and fatigue exists only in playback state. Each on-court row also gained a one-glance ratings line under the name, so the common question doesn't need a click at all. Visibility follows Tier 17's own-roster-vs-opponent split throughout: your own five quote overall and their best attribute's rating, the opposing five get the attribute named with no number and no overall, trading the attribute sheet for a sentence. `Inspector.openTeam` is now nullable and `TeamName` degrades to plain text on null, since there's no team page reachable from inside a broadcast.
- **Idea, unscoped** -- live lineup editing during the overtime pause. Deliberately not built: injecting a GM's mid-game edit means threading a live mutable channel into what is otherwise a pure, seed-deterministic simulation -- the same `simulateGameSteps` that also runs every AI-vs-AI game with no UI attached. Folded into Tier 13, which has to solve that problem anyway.
- **Deepens into Tier 7.7** -- the labeled-court-view simcast (`detailed-simcast.md`) renders the same possession log this tier already produces; it's an alternate presentation, not a replacement.

---

## Tier 7.6 — Rotation Charts & Lineup Control
**Shipped**

Not part of the original phase plan. A 2K-style rotation chart, and the engine rework it required. Has its own deep-dive doc: `rotation-charts.md`.

- **Real game clock.** The engine was possession-counted with no quarters; it now runs four real 12-minute periods plus uncapped overtime, driven by a clock rather than a loop bound. Possession duration is sampled per play call with outcome adjustments, so **pace falls out of the playbook mix** instead of being an input. Minutes played are summed from real elapsed seconds.
- **Slot-assigned lineups.** The on-court five is `{ player, slot }` rather than a bag of players, so matchups pair slot against slot and a player can be charted somewhere that isn't his listed position.
- **Period-break rest** -- **Shipped**: fatigue used to accrue continuously from the opening tip to the final buzzer, with nothing in the model aware that quarters end or that halftime exists. A player eight minutes into a shift was treated the same whether those minutes ran straight through or straddled a fifteen-minute interval. Breaks now hand **every** player a flat number of points back -- 35 at halftime, 12 at a quarter or before an overtime -- scaled by the same durability multiplier bench rest already uses. Flat rather than a share of accumulated fatigue: a break is a fixed span of sitting down, and how much good it does should not depend on how tired you happened to be when it started. Measured over 40 games, this took substitutions from **51.3 to 44.6 a team-game** while keeping the share made at 80+ fatigue at **zero**, and — against the worry that resting players would leave the bench unused — *improved* mean minutes error against target from **5.80 to 4.82**. Less fatigue-driven churn leaves more room for the pace check to do its job. `rotationRealism.test.ts` pins all three.
  - **The part that made it more than a two-line change:** four separate places model fatigue — the live sim, the simcast's energy-bar replay, the Coaching Insights reconstruction, and the rotation chart's projection — and all four had to apply the identical rule or they would quietly disagree about the same game. The rule lives in one function (`engine/rotation/fatigue.ts`'s `applyBreakRecovery`) that all four call. The simcast agreement test failed first when this landed, which is exactly what it is for.
- **Fatigue costs performance** -- **Shipped**: until this landed, fatigue was never read by anything that resolved a possession, so a gassed player shot exactly as well as a fresh one and the whole system was a rotation signal rather than a simulation input. A tired player is now docked on the same transient copy `effectiveFive` already built for the out-of-position penalty, which is why neither effect needed plumbing: `selectPlayers`, `computeOffenseStrength`, `computeResistance`, `offensiveReboundProbability` and `pickRebounder` all read `player.attributes`, and `computeConsistencyNoise` reads `player.hidden.consistency`. `effectiveFive` moved out of `positionFit.ts` into `engine/onCourtEffects.ts` when it stopped being about position fit.
  - **Weighted toward the legs.** Outside shot, speed, lateral quickness and vertical take the full dock; passing takes a fifth of it. Shooters fade and bigs endure, so who closes a game is a decision rather than "play the best five".
  - **Two effects, both from one docked copy.** Level (attributes) and variance (`hidden.consistency`, which `variance.ts` already turns into a wider swing with no change to that file).
  - **The measurement that reshaped the design: nobody ever gets tired.** Across 30 games and 32,075 player-possessions, on-court fatigue runs median 24.4, p90 45.5, **max 65.3** -- the rotation is built to prevent exhaustion and it succeeds. A penalty band of 50-to-100, which is what the plan assumed, would have reached about a third of its strength at the tiredest moment anyone reached; a threshold of 70 would have been dead code. The band is 35-to-65 instead, calibrated to the fatigue that actually occurs rather than to the nominal scale. `rotationRealism.test.ts` now asserts the feature stays *reachable*, so a future rotation tune cannot silently kill it.
  - **Scoring did not move** (221.1 combined points, before and after), exactly as predicted: both teams tire, so the margin between strength and resistance shifts far less than either term. `scoringCalibration.test.ts` passes untouched.
  - **What did move, and the surprise:** tired shooters lost ~0.7 points of field-goal percentage, but they also took **7% fewer shots** -- a monotonic, well-outside-noise effect nobody designed. `selectPlayers` weights by fit score, so a tired player is a worse fit for the play call and simply gets the ball less. Usage turned out to be the stronger channel of the two.
  - Magnitude honesty: across 8 / 16 / 24 at 250 games a cell, the *efficiency* differences sat inside one standard error, so 16 was chosen as a middle value with a clear usage effect rather than because measurement singled it out. The depth test (deep bench versus thin) proved unusable at any feasible sample size -- win rates bounced 65/70/65/65 -- and is recorded here as a thing not to re-derive.
- **Out-of-position penalty.** Playing someone out of position docks their attributes transiently, for that possession only -- demand-weighted, so a PG at center loses rebounding and interior defense but keeps his passing. Because synergy and projected usage read the same attributes, an out-of-position lineup automatically contributes less and draws fewer touches with no bespoke wiring. Positionless/Specialist quirks are *derived* from height-band overlap and attribute spread rather than stored, so they can't drift out of sync with the player.
- **The chart editor** (My Team): five slot rows by four quarter columns, each cell a timeline of segments. Assign a player or leave Auto; split, merge, and drag boundaries. Live validation surfaces charted minutes per player, double-booking conflicts, out-of-position badges, and projected fatigue at each period's end.
- **Charted spans are law**, with one deviation: a charted player who hits emergency fatigue gets pulled anyway, and the chart resumes once he's genuinely recovered (a 15-point hysteresis band, so a deputy isn't yanked after one possession of rest). Coaching Insights reports a chart override distinctly from an ordinary fatigue sub.
- **Unsatisfiable charts degrade safely.** A chart naming one player in two slots at once used to seat him twice -- four bodies on the floor, and doubled minutes flowing into season development. All five slots are now resolved against the chart before any is applied; a double-booked player wins the first slot that asks and the loser falls through to the coach heuristic.
- **Minutes are a per-position budget.** Each position group shares exactly 48 minutes, 240 team-wide, so raising one player means lowering a teammate at his position. This enforces an invariant the generator already had; a readout above the roster shows each position's allocation.
- **The chart feeds synergy and projected usage** (see Tier 6). Charted spans count exactly; `rotationMinutes` governs Auto time, prorated by how much of that slot's budget the chart hasn't spent. Reduces identically to the old behavior when no chart exists.
- **Shipped -- the position-fit quirk thresholds are retuned** (M3 item 1; full before/after in `m3-tactical-axis.md`). The suspected Positionless/Specialist skew was measured across 30 generated leagues (~2,900 players) and was worse than "almost any pure PG": **76.0% of point guards and 58.2% of centers read as Specialist**, and neutral was the *least* common outcome at every position but center. A label meant to mark a player built for exactly one slot applied to most of the league, so it carried no information -- and since Specialist multiplies the penalty by 1.5, the harsh case was the common case. Two arithmetic causes, both now fixed. The attribute test ran on a raw max-minus-min, but `POSITION_BIAS` builds 30 points of spread into a point guard by construction, so it largely asked "is this PG shaped like a PG" -- `positionRelativeSpread` subtracts the position's own bias first, which collapses the median spread to 32-34 at *every* position (raw ran 34 to 48.5). And the height arm of `isSpecialist` was **removed rather than retuned**: `effectivePlayer` already charges an extreme height per inch through `heightMisfitInches`, so flagging it again double-counted -- and multiplied the unrelated slide-distance term by 1.5 as well, via a one-inch cliff that a quarter of every position fell over regardless of the constant's value. Result: neutral is now the plurality everywhere at 60-67%, with both labels at 9-25% (PG 18.7/64.4/16.9, SG 20.1/59.9/20.0, SF 14.6/67.3/18.1, PF 21.9/60.5/17.5, C 9.4/66.0/24.6). C's low Positionless share is structural and correct -- a center's height lands in a second band only 37.6% of the time. The distribution is asserted in `positionFit.test.ts` rather than eyeballed once.
- **Retuned again when Tier 0's talent ladder landed.** Raising the league's ratings compresses measured attribute spread from the top -- a star whose best attributes clamp against `ATTRIBUTE_CEILING` reads flatter than the same player twenty points lower -- which had pushed Positionless to 31% at some positions. `POSITIONLESS_ATTRIBUTE_SPREAD_MAX` moved 26 -> 24; measured across 40 leagues (3,840 players) the population median moved 32-34 -> 31 and the top decile sits at 28. Some correlation between quality and Positionless survives at 24 deliberately -- a genuinely excellent player being able to line up anywhere is a fair reading, unlike the original bug this pair was retuned for.
- **Planned -- tune the penalty magnitudes themselves** (M2 playtest question): `POSITION_FIT_SLIDE_PENALTY_PER_SLOT` and `POSITION_FIT_HEIGHT_PENALTY_PER_INCH` are still first-pass estimates written before any chart existed to exercise them, and they were deliberately left alone during the threshold retune -- changing labels and magnitudes together means being unable to attribute either effect. Slide cost after the retune: **4.43** points of raw overall at one slot, **11.52** at two, **18.78** at three, **24.33** at four (down 10-15%, purely from removing 1.5x surcharges that should never have applied). Whether those are the right size is a question for play, not measurement.
- **Planned -- paint mode** (M7): pick a player, then click-drag across the grid to lay them straight into the time you drag over, instead of splitting and assigning as separate steps. The underlying plan mutations already exist, so this is a new *input* over the same operations -- mostly pointer handling. Decide whether painting respects the minimum-segment floor (probably yes), and make sure a stroke persists once on release, the way the boundary drag already batches to avoid a write per pixel.
- **Explicitly out of scope here:** foul trouble and injuries as chart deviation rules. Neither system existed to build a rule on top of -- both are now Tier 14, which inherits this as part of its own work.

---

## Tier 7.7 — Detailed Simcast (Court View)
**Planned -- not yet scheduled -- has its own deep-dive doc: `detailed-simcast.md`**

Not part of the original phase plan, but not really new either -- Hoop Sim's own design doc (Section 7,
"Simcast (Visual Playback)") specified almost exactly this before Tier 7.5 shipped the text broadcast
under the same name: a top-down court with dots/icons for players, rendered from the possession log
as a "puppet show" rather than a second simulation. Tier 7.5 built the text half of that plan; this
tier is the visual half -- labeled circles for players and the ball, moving on a court, roughly in
real time.

- **A pure rendering layer over the existing possession log** -- adds nothing to
  `PossessionLogEntry`, needs no save migration, and requires no `engine/` changes. Everything a
  choreography generator needs (on-court fives with slot, the primary/secondary actors the commentary
  text already names, play call, outcome, shot type) is already logged today.
- **The one hard constraint: possessions stay individually generated.** `simulateGameSteps` yields one
  possession at a time specifically so a future in-game decision (Tier 13) can land between any two of
  them via `.next(directive)`. This tier's choreography must be generated only once a possession has
  actually been pulled from the generator -- never pre-computed or buffered ahead of the render
  cursor -- or it quietly breaks the thing Tier 13 depends on. See `detailed-simcast.md` §1, and the
  "Hard constraints" list above.
- **New work is a coordinate model and a choreography generator**, not new simulation math: a
  normalized half-court, zone anchors per slot (reusing `SLOT_INTERIOR_LEAN` for the interior/perimeter
  axis rather than inventing a parallel scale), and a deterministic possession-entry-to-waypoints
  function keyed off the 6 existing play-call types.
- **Needs its own pacing**, decoupled from the text feed's tick rate -- a possession's game-clock
  duration and the wall-clock time needed to read player movement have nothing to do with each other.
  Proposed as an alternate rendering mode over the same generator and playback state, not a parallel
  playback path.
- **Sequencing relative to Tier 13:** buildable independently and doesn't block it, provided the
  individual-generation rule holds. The two features share the same yield point in
  `simulateGameSteps`, so a substitution directive (Tier 13 level 3) landing between possessions should
  already flow through correctly -- choreography is generated fresh per possession from that
  possession's own logged on-court five, never cached from an earlier one.

---

## Tier 8 — Run Conclusion
**Shipped -- Phase 10 (M1)**

Post-run epilogue: "what actually got you fired" across the whole run, replacing three lines of "you survived N seasons."

- **This was the biggest gap between what the design doc promised and what the build delivered.** Section 1's fourth pillar calls commentary and insights "the emotional payoff of every run's ending," and the run just stopped.
- **Built from retained standings, not Coaching Insights** -- and that turned out to be the right source rather than a compromise. Insights derive from possession logs, which are discarded as each chunk resolves (Tier 1.5), so nothing play-level survives to the end of a run. What does survive is `League.seasonHistory`: one row of final standings per completed season, kept deliberately for this. Insights explain a *game*; a run's ending is a question about *seasons*.
- **Insights now survive the run too, in a small structured residue** (`run/runInsights.ts`). A few notable observations are kept per season as each chunk resolves, so the epilogue can say *how* the team kept losing rather than only that it did. Storage is bounded per season, not overall, so every season stays represented and growth is RUN_INSIGHTS_PER_SEASON x seasons played -- a rounding error beside the logs they came from.
- **The arc is reconstructed by replaying the state machine.** Standings don't record which stretch a season belonged to, or what the bar was at the time, since the target tightens as stretches clear. Both are recoverable: the transitions are deterministic, so `run/runSummary.ts` replays `evaluateSeasonEnd` forward over the retained rows. Its tests drive the *real* state machine over the same fixtures rather than hand-setting run state, so the replay can't quietly drift from `runState.ts`.
- Surfaces a per-season table (needed vs. finished, record, differential, cleared or missed by how many wins), a verdict line that reads differently depending on whether the run was ever close, run totals, and the build that produced it.
- The **Needed** column shows the resolved rank, not the fraction it came from: "top 10%" of an eight-team league means 1st, and making the reader convert buries the point. Side by side with Finish, the escalation reads as a ladder -- 4th, 4th, 3rd, 2nd, 1st.
- **Still open -- make it screenshot-shaped.** See Parked, "Shareable run recap card." The layout is now set, so this is no longer free; it's a compact-recap variant of a screen that exists rather than a decision to make while building it. Cheaper than a rewrite, dearer than it would have been.

---

## Tier 9 — Cross-Run Meta-Progression
**Planned -- Phase 11** (leaderboard) **/ Idea, unscoped** (unlocks)

- **Local leaderboard** (planned): longest survival streak, best single-season record. No backend, matches the local-only architecture.
- **Cross-run unlocks** (idea only): new house-rule/system/upgrade content unlocking the more you play. Explicitly distinct from Tier 5's Budget, which resets every run -- this would be the *only* thing that persists across runs. Not yet scoped; may not be needed if Tier 7's shop pool alone provides enough variety. **There is a counter-argument for promoting this** -- in a roguelite it is often the biggest lever on whether anyone plays a sixth run -- see Parked, "Cross-run meta-progression." Decide with M2 data.

---

## Tier 10 — Distribution
**Planned -- Phase 12+**

Sequenced deliberately last -- validate the loop is fun as a plain browser app before investing in packaging:

1. Browser build, itch.io, free/pay-what-you-want for validation.
2. Electron-wrapped downloadable build (same code, no rewrite), added once the loop is validated. Storage already goes through IndexedDB (Tier 0), which behaves identically under Electron's embedded Chromium -- no persistence rework expected at this step.
3. Steam release via the same Electron build, `steamworks.js` for achievements/leaderboards -- wired to Tier 9's leaderboard behind a swappable interface, same pattern as the storage adapter.

Tiers 11-22 below were added after this one and are gameplay work, so despite the higher numbers they come *before* distribution in the Build Order -- numbers are identifiers, not sequence.

---

## Tier 11 — Simulation Fidelity
**Planned**

Deepening what the possession model actually tracks. **Both items below change `PossessionLogEntry`'s shape, which invalidates existing saves with no migration path** -- `isValidBundleShape` rejects rather than migrates, deliberately, on the grounds that nothing has shipped. That's still true, so this is the cheap moment, and it stops being cheap the day there are real players with real runs. Treat them as one unit of work.

- **Shipped -- rebounds during the sim** (M1): `PossessionLogEntry.rebounderId` is set when the miss resolves, using `pickRebounder` -- which already existed in `possession/rebound.ts`, exported and entirely unused. Two things fell out of it: `deriveBoxScore` is now a pure function of the log (it took an `Rng` only for this roll, and no longer needs `playersById` either), and the simcast shows **real rebounds live** -- `LiveBoxScoreLine` was `Omit<PlayerBoxScoreLine, 'rebounds'>` and the REB column rendered a dash for the whole game.
- **Shipped -- rebounds weighted toward bigs** (M1.5): measured before and after over 6 simulated seasons (~35,000 boards). Centers went from 7.76 to **9.64 reb/36** and point guards from 5.31 to **3.76**, moving the C:PG rate ratio from **1.46 to 2.56** against a real-basketball figure near 3 — every position now lands within about a rebound of its NBA rate. Purely an attribution change: `offensiveReboundProbability` decides possession *before* `pickRebounder` is called, and the pick still spends exactly one `rng()` draw however the weights fall, so no game outcome and no existing seed moved. The two causes were:
  - `pickRebounder` weights **linearly** by the `rebounding` attribute, so a 55-rated guard takes nearly as many boards as a 75-rated center (55/75 = 73% as often). Compare the offensive side, which raises selection scores to `USAGE_WEIGHT_EXPONENT` (3) precisely so the best-suited player dominates a role without monopolising it. Rebounding is the same kind of contest and has no such exponent. **Reusing that constant is the obvious first attempt**, and keeps the two concentration knobs from drifting apart.
  - Nothing but the attribute is read -- not height, not position, not `vertical`. A 6'0" point guard and a 7'0" center with equal Rebounding are equally likely to come down with it, which is the part that reads as wrong regardless of how the numbers are tuned. `avgInteriorDefense` (interiorDefense + vertical) already exists as the engine's "big man" composite and is the natural blend partner.
  - Shipped as `REBOUND_WEIGHT_EXPONENT` (equal to `USAGE_WEIGHT_EXPONENT`, named separately so the two can diverge) and `REBOUND_SIZE_WEIGHT` (0.4). Both are first-pass numbers set against real per-position rates, not against play feel -- **a tuning candidate for M2** if boards feel too concentrated in practice.
- **Shipped -- defensive stats** (M1): steals and blocks, as attribution fields (`stolenById` / `blockedById`) rather than new outcomes -- a steal is still a turnover and a blocked shot is still a miss, with the same attempt and the same rebound, so no existing branch changed. Both are decided *after* the outcome roll, which means turnover and make/miss rates are untouched by their existence and can be tuned independently. Credit goes to the matchup defender the possession already identified. Measured over 160 games: 5.8 steals and 4.3 blocks a team a game, blocks at 4.9% of attempts against a real ~5%. Steals run light because the engine's turnover rate itself is light (~10.4 against a real ~13.5) -- inherited, not introduced, and the fix belongs in `TURNOVER_BASE_PROB`. **Deliberately stopped short of personal fouls committed**, which would drag in foul trouble and foul-outs: that stays Tier 14.

---

## Tier 12 — Season Structure
**Planned**

Playoffs, and the league configuration they need. One connected piece of work; the order within it matters more than usual.

- **League structure: size and conferences** (M4) -- **Planned**: everything is a fixed constant today -- 8 teams, 32 games, 4 chunks. Two real constraints to turn from comments into validation rules: team count **must be even** (the round-robin schedule generator requires it), and season length is chosen so `SEASON_LENGTH / CHUNK_COUNT` divides evenly (32/4 = 8 games a chunk). Needs somewhere for run configuration to live -- a new concept, since market size and house rules are *rolled*, not chosen -- plus a setup screen. `league.ts` already anticipates this: "MVP: no conferences/divisions. Literal union leaves room for future structures." **Decide first:** whether these are run-creation options (fixed for a run, like market size) or global settings. The roguelite framing argues for run-creation -- the whole design is built on constraints you're handed rather than dialled in.
- **Playoffs bracket** (M4) -- **Planned**: none exist; a season is 32 games and then it ends. Needs seeding from standings, a series format, and a schedule generator that isn't the round-robin one. Conferences are the natural seeding basis, which is why they come first. **Decide first:** series length -- a 7-game series against a 32-game regular season is a large fraction of a run's play time, and the ~5-10 minute session target argues for short series or single elimination. Also whether missing the playoffs is survivable or an automatic firing.
- **Graduated expectations** (M4) -- **Planned**: `RunTarget` is currently a single number, `{ rankFraction }`, tightened each stretch-clear and checked against final standings. Generalize it to a named milestone -- make the playoffs, reach the second round, conference finals, win it. Mostly `target.ts`, `runState.ts` and the screens that display the target. It's a better fit for the roguelite escalation than a percentage anyway: a GM understands "get to the second round" better than "finish in the top 30%." **Why after the bracket, not before:** this could ship standalone with milestones defined against regular-season finish, but then real playoffs arrive and every milestone gets redefined. Define them once, against the real structure. Note the design doc's Section 7 flags this as interacting with the "too forgiving" variance concern -- a playoff bar adds its own variance rather than replacing the need to tighten the rest.
- **Run-configuration toggles** (M5) -- **Planned**: lineup customization on/off and similar. Small once league configuration exists -- same object, same screen, more switches. **"Injuries on/off" waits on Tier 14**, which is why these toggles sit in M5 rather than alongside the rest of Tier 12 in M4 -- there is no injury model to switch off until then.

---

## Tier 13 — In-Game Decisions
**Planned -- split across M3 (levels 1-2) and M6 (levels 3-4)**

Timeouts, substitutions, play-calling, offensive/defensive focus points, matchups, and defensive scheme switching. The single largest planned item, and really a container for several. The architecture was deliberately laid down early and is still waiting.

**Deliberately split.** Levels 1-2 below are the game's **second strategic axis** -- the first thing that makes *how you play a game* differ from run to run, rather than only how you assembled the roster. That's worth a lot in a roguelite and costs comparatively little, so it lands early at M3. Levels 3-4 are the hard, risky part and stay last at M6.

`simulateGameSteps` yields after every possession and its doc comment names this exact use -- it "is the pause point future interactive coaching decisions (timeouts, subs, matchup/emphasis changes) will hook into." Tier 7.5's overtime prompt is the first real instance of it. Tier 7.7's court-view simcast leans on the same yield point and the same constraint (`detailed-simcast.md` §1) -- both features depend on nothing ever being generated ahead of wherever the GM currently is in the broadcast.

Defensive schemes already half-exist: five ship as presets (Man-to-Man, Zone, Switch-Everything, Pack-the-Paint, Full-Court Press) and the sim reads the chosen one every possession. They're a **team-level, set-before-tipoff** choice today, so making them switchable mid-game is plumbing, not modelling. A genuine combo man/zone is a new preset entry rather than new machinery.

**The four levels, in increasing difficulty:**

1. *Pausing on a condition* (**M3**) -- already solved by the overtime prompt; generalize it.
2. *Changes affecting only future possessions* (**M3**) -- defensive scheme, focus points, play-call emphasis. These need a channel into the loop but never rewrite state the loop owns, which is what makes them tractable well before the rest. Level 2 alone delivers mid-game scheme switching, the single largest perceived win in this tier relative to its cost.
3. *Substitutions and matchups* (**M6**) -- these mutate `RotationState`, which the generator owns in its closure. This is the hard one, and what Tier 7.6 explicitly declined to build.
4. *Timeouts* (**M6**) -- needs game state that doesn't exist yet (timeout counts, stoppages). Related known gap: there are no dead balls at all; subs are evaluated every possession.

**The determinism problem has a designed answer already — use it.** Hoop Sim's design doc (Section 14.2, item 6) specifies the mechanism for exactly this feature: *"teaching `simulateGameSteps`'s yield point to accept a directive via `.next(directive)`."*

That is the right answer and it dissolves the concern this tier was written around. A generator's `.next(value)` delivers the value as the result of the `yield` expression, so a directive arrives as an **input to the loop** rather than as a mutation of state the loop owns — `Generator<SimulationStep, Game, Directive | undefined>`. Determinism is preserved for free, because a directive is just another input alongside the seed; a seeded replay handed the same directives produces the same game. Headless AI-vs-AI games call `.next()` with no argument and behave exactly as they do today. No mutable channel into the closure, no shared state.

This meaningfully de-risks M6 -- the part that looked hardest is a solved design. It doesn't shrink the estimate much, since levels 3-4 still have to define what a substitution directive *does* to `RotationState` mid-period and still need real mid-broadcast UI, but it removes the architectural unknown.

**Still decide at M3, because it constrains M6:** the directive type itself. Levels 1-2 need only a narrow version, but designing the shape with levels 3-4 in mind costs little now and saves a rewrite later.

---

## Tier 14 — Risk & Attrition
**Planned -- scheduled M5 -- needs a design pass before it can be built**

Injuries and foul trouble. Grouped because they're the same idea mechanically: a player becoming unavailable, temporarily or for good, against the GM's wishes.

**Why this is scheduled rather than parked.** It reads as a realism feature but it's really a *strategic axis* -- the thing that makes rotation depth matter. Right now a GM can ride five starters all season with no consequence beyond fatigue, so bench quality is nearly decorative and the per-position minutes budget (Tier 7.6) has no teeth. Attrition turns load management into a genuine decision and gives the shop's depth-oriented purchases (Bench Mob Mentality, Iron Man Program) something to protect against.

- **Injuries** -- **Planned**: no model exists. `PlayerHiddenTraits.durability` is named for it, but per its own doc comment it's injury risk *in contract only* -- the field actually drives in-game fatigue and nothing else, so the hook is half-built and unused. Unblocks Tier 12's "injuries on/off" toggle, which is why that toggle is grouped into M5 rather than M4.
- **Foul trouble and foul-outs** -- **Planned**: no personal-foul accumulation exists. Directly tied to Tier 11's open decision about whether defensive stats include fouls *committed* -- if that decision goes yes, the accumulation lands there and this becomes just the foul-out rule and its rotation consequences.
- **Rotation-chart deviation rules** -- both systems need one. Tier 7.6 handles an exhausted charted player by falling through to the coach heuristic with a hysteresis band; an injured or fouled-out player needs the same treatment, and explicitly wasn't built because neither system existed to hang it on. The pattern to copy is already there.

**How punishing attrition should be is the real work here, and Tier 15 now answers half the question.** A season-ending injury to a star is a run-ending event if there's no way to replace him and an ordinary setback if there is. Tier 15 settles that: replacement exists, but it's a **shop purchase competing with camps and upgrades**, so an injury doesn't end a run -- it taxes one. The cost lands on the Budget rather than on the roster directly, which is a more interesting failure mode than "your star is gone, good luck."

**Therefore build and tune the two together at M5.** They're the same balance problem from two directions: attrition sets how often you need a replacement, acquisition sets what one costs. Tuning either in isolation means tuning it twice. Prototype at low severity and raise it rather than the reverse, and watch the interaction with the "too forgiving" difficulty concern from Tier 1 -- attrition is the most direct lever on that problem anywhere in this document.

---

## Tier 15 — Roster Turnover
**Planned -- attrition and shop-based acquisition both scheduled M5 / trades post-launch**

> **Decided:** player acquisition happens **through the shop**, as a purchase competing with camps
> and coaching upgrades — not through a free-agent market, and not through a transaction system.
> That resolves the branch this tier was originally written with two answers to, and it un-gates
> Tier 14's injury tuning (see below).

Players leaving and arriving: retirement, aging out, poaching, and buying a replacement in the shop.

**This reverses a stated design decision, deliberately.** Section 5 of the design doc lists "draft/free agency as currently scoped" under *explicitly not reused*, on the grounds that this is bounded runs rather than an ongoing save. The reason it was excluded is the thing to design around rather than a reason not to do it: the premise is being handed a bad team and being unable to escape it, and free agency is the standard escape hatch from exactly that. If a GM can rebuild a roster in two seasons, "how long can I survive" quietly becomes "how fast can I fix it" -- a different, and much more common, game.

**The split that keeps the pillars intact: imposed loss, drafted gain.** This maps onto the structure the design already runs on -- Tier 3 is things that happen *to* you, Tier 4 is your answer to them.

- **Losing players is pressure.** No agency, pure hot seat: the roster you spent Budget building erodes while the target keeps rising.
- **Gaining players is agency, and stays scarce and expensive.** One signing per stretch-clear, paid out of Budget, competing directly against camps and coaching upgrades.

Framed that way turnover *raises* pressure rather than releasing it, which is the opposite of what a conventional transaction market does.

### What makes this cheaper than it sounds

- **Budget is already the constraint.** No contracts and no salary cap needed -- a signing is a purchase competing with everything else in the shop. That sidesteps the single largest chunk of franchise-sim plumbing.
- **The shop is already the acquisition surface**, with the right cadence baked in (condensed every season, expanded on stretch-clear) and a rolled-offer-plus-reroll flow already built. A free agent is another card type in a pool already being rolled from.
- **`Player.teamId` is already `TeamId | null`**, so the data model permits an unaffiliated player today. Nothing structural blocks a free-agent pool.
- **`pickDistinct` and `DraftOptionCard`** (Tier 4) are the pick-one-of-N mechanic already in use for quirks, house rules and systems. A rookie pick or a shortlist of free agents is the same interaction.

### The pieces, in build order

- **Retirement and aging out** -- **Planned, M5**. Build first: there is no retirement system today, and `growPlayerOneSeason` compensates with a hard decline floor specifically so a long-lived veteran can't decay forever. This is the piece that *creates the need* for acquisition, so doing it first means signings arrive as a solution to a problem players already feel rather than as a shopping feature. ~3-5 days.
- **Roster backfill** -- **Planned, M5**, and the consequence that's easy to miss: once players leave, rosters shrink and the league erodes over a long run. Something has to replace them. Cheapest version is auto-generating replacements for AI teams and giving the user a pick from a small generated pool -- which is a rookie draft in miniature, reusing the Tier 4 draft-card UI rather than building a draft system. ~2-4 days. A fuller rookie draft is a natural later expansion.
- **Poaching** -- **Planned, M5**: a good young player leaves for a rival between seasons. Pure Tier 3-style imposed pressure, and it gives the wildcard-event system (Tier 3) a new beat to narrate. ~2-3 days.
- **Shop-based acquisition** -- **Planned, M5**: a signing is a **card in the shop's rolled offers**, priced against Budget and competing directly with camps, coaching upgrades and consumables. Expanded tier only (stretch-clear), one per visit, so it stays a scarce and genuinely costly choice rather than a roster-fixing tool.

  This is the shape that keeps the pillars intact. It needs **no contracts and no salary cap** -- the Budget already is the constraint, and spending it on a body is spending it not on improving the bodies you have. It reuses the rolled-offer-plus-reroll flow that already exists for upgrades and consumables, and `pickDistinct` / `DraftOptionCard` (Tier 4) for the pick-one-of-N interaction. `Player.teamId` is already `TeamId | null`, so an unaffiliated player is already representable.

  **Roster spots are the second constraint, and the interesting one.** `maxRosterSize` is 12, so signing into a full roster means cutting someone -- a real decision with no new machinery behind it. Attrition (above) opens spots naturally, which is why the two belong in the same milestone: built together, a signing reads as *replacing what you lost* rather than as shopping. ~5-8 days.

  **Open questions:** how the offer pool is generated (flat random, quality-tiered by price, or biased toward positions the roster is thin at); how much of a prospect's quality is visible before buying, and whether scouting is the thing that reveals it; whether a signing can be made mid-season or only at the shop's normal cadence.
- **Trades** -- **Idea, post-launch**: staged last on purpose. They need valuation logic on the AI side, which is real work, and they're the most time-expensive decision surface for the player -- directly against the 5-10 minute session target. A simplified "swap offer" card in the shop gets most of the feel for a fraction of the build; a full negotiation market is a different product.

### Two scoping branches

| Version | Contents | Days | When |
| --- | --- | --- | --- |
| **Turnover as shop content** ← **chosen** | Retirement, backfill, poaching, one shop signing per stretch-clear | 10-16 | M5, alongside Tier 14 |
| A real transaction market | Contracts, cap, AI GMs, multi-season roster planning, trades | 30+ | Post-launch at the earliest, and only if there's real demand for it |

The chosen version is an extension of systems that already exist -- shop, Budget, offer rolls, draft
cards -- rather than a new subsystem. The second changes what the game *is* enough that it wants
playtest evidence behind it, not ahead of it.

**What M2 decides now.** The playtest no longer decides *whether* acquisition ships, but it should
still set its **price and scarcity**. This is the one mechanic that could deflate the core tension
rather than deepen it: if a signing reliably fixes a bad roster, "how long can I survive" becomes
"how fast can I fix it." Err expensive and rare, and loosen from there -- the same
prototype-low-and-raise discipline Tier 14 needs.

---

## Tier 16 — Legibility & Comprehension
**Planned**

Everything the game already computes but doesn't successfully *tell* the GM. Grouped as one tier
because they share a failure mode rather than a feature area: the simulation is right and the screen
is silent about it, so a correct result reads as arbitrary or as a bug.

**The two headline items pull against each other and have to be solved together.** "More descriptive
cards and screens" and "compact sections into single-screen views" are opposite instructions if taken
one at a time -- more words in the same space, or the same words in less. What resolves them is
**progressive disclosure**: a compact summary that always fits, with the explanation one hover or one
expand away. Deciding that up front is what stops the two items undoing each other's work.

- **Shipped -- Coaching Insights after every game** (M1.5), and it was the cheapest item in this tier:
  insights are already generated per game (`resolveGame` calls `generateCoachingInsights` on each) and
  already persisted per game in `bundle.pendingChunkInsights` while a stretch is open. Nothing needs
  computing; a stretch's games each have their insights sitting in state, thrown away visually until
  the checkpoint aggregates them. Surfacing them next to a game's box score on the stretch screen is a
  display change. **Watch the interaction with the checkpoint summary**: per-game insights are the raw
  per-game text, and the checkpoint deliberately collapses repeats (`run/chunkInsightSummary.ts`) --
  showing both is right, but the checkpoint must stay the collapsed view or it re-acquires the
  twelve-bullet problem that summariser exists to fix.
- **Shipped -- team records in the schedule** (M1.5): the stretch screen listed Date / Matchup /
  Result with no standing context, so "who am I playing and are they any good" meant a trip to the
  standings and back. Records are **as of that game** rather than current
  (`recordsThroughGame`), so a finished row reads as the record it produced and an upcoming row as
  what both sides carry into it -- a season-to-date record next to a game from three weeks ago is a
  different and more confusing fact than no record at all. Read from the whole season rather than
  the chunk, so it doesn't restart at 0-0 every stretch.
- **Shipped -- standings comprehension, not standings arithmetic** (M1.5), and reframed from the
  original request. The request was that a winning record should always carry a positive point
  differential, a losing one negative, and a .500 team should be even. **`pointDiff` is computed
  correctly** (`pointsFor - pointsAgainst` in `engine/schedule/standings.ts`) and the disagreement is
  real basketball: a team that wins close and loses badly genuinely earns a winning record and a
  negative differential. Measured over 320 simulated team-seasons:

  | Measure | Value | Read |
  |---|---|---|
  | correlation(winPct, pointDiff) | **0.902** | Healthy — real NBA is ~0.94 |
  | winning record, negative diff | 3.1% | Realistic, not a defect |
  | losing record, positive diff | 4.1% | Realistic, not a defect |
  | mean \|diff\| for a .500 team | 33.9 over 16 games (~2.1/game) | Normal; forcing 0 would mean fabricating scores |

  So the numbers stay. The real defect is that the table never says what DIFF *is*, which is why a
  correct 6-2 record next to a −15 reads as broken — and if it read that way to the person who built
  the game, it will read that way to every playtester. **The fix is a sentence, not a formula**: label
  the column, and consider showing the differential *per game* rather than cumulative, which is the
  form the number is actually intuitive in.
- **More descriptive cards and screens** (M7) -- **Planned**: the draft, reveal and shop cards state
  *what* an option is but rarely *what it will do to you*. The pattern already exists and works --
  `SystemChoiceCard`'s play-call breakdown and `defensiveFits`' roster-fit note both explain a choice
  against the specific roster on screen. Extending that to house rules, quirks, upgrades and
  consumables is applying a solved idea, not inventing one. **After M2, not before**: the specific
  wording should come from what playtesters actually asked about, and the Parked onboarding note
  already commits to taking those notes during M2.
- **Shipped -- compact, single-screen sections, and a first broadcast/visual-identity pass** (pulled
  forward from M7): measured at 1280x800 in screens-worth of scrolling, Team Reveal ran 4.65, My Team
  3.90, Checkpoint 2.42 -- and the shape of the problem was consistent across all three, the thing you
  act on buried under the thing you consult (Team Reveal's two decisions totalled 1064px, sitting below
  1623px of scouting cards). Two causes, and only one was about volume: `#root` was capped at 900px, so
  a 1280px window left ~380px unused before anything got hidden -- layout was spent before content was.
  `ui/components/Section.tsx` (native `details`/`summary` rather than a `useState` toggle -- keyboard-
  operable and screen-reader-announced for free, default state as an attribute) now folds what you
  consult and leaves open what you act on, per call site, with a `summary` prop so a folded section
  still says whether it's worth opening. A `.screen-columns` grid splits above 1100px and stacks below
  unchanged. On the Checkpoint the scheme and tactical dials moved under Coaching Insights, closing a
  gap between a complaint and its fix that had drifted a full screen apart. Result: Team Reveal 4.65 ->
  1.93, My Team 3.90 -> 1.58, Checkpoint 2.42 -> 1.41. **Two miss the 1.5 target on purpose, not by
  oversight**: My Team is a twelve-row roster editor and that table is most of the column, and Team
  Reveal's constraint is the left column -- comparing four systems and five defences is the screen's
  whole job, and reaching 1.5 there means folding away a decision, which isn't worth a better number.
  `BoxScoreTable` and `StandingsTable` were the only wide tables with no `.table-scroll` wrapper, so
  they widened the *page* instead of scrolling inside themselves -- fixing that took the layout
  viewport at 375px from 602px down to the actual 375px, which is what had been stopping the simcast
  player card (above) from sizing itself correctly on a narrow screen. **The broadcast pass starts
  here**: team colour is now published as CSS custom properties (`ui/teamColors.ts`) -- every team has
  carried a primary/secondary pair since generation, and the only thing reading it before was a 10px
  dot. The scoreboard becomes a scorebug (two team-coloured blocks with the clock between them and the
  scores flanking it, so the margin reads at a glance), the team swatch becomes an upright bar where
  both halves of the palette are legible, and tabular numerals now apply to every numeric cell rather
  than the few that asked. **Deliberately not here**: a condensed display face, since there's no
  webfont in the project and itch builds are self-contained -- committing one means a self-hosted woff2
  and its licence, a decision left open rather than made by default. UI only; no engine, `run/`, or
  save-shape change. Pairs with the item above under the same progressive-disclosure decision -- that
  item (wording on the cards themselves) is still open and still waiting on M2 notes.
- **Shipped -- performance trends and a dedicated Insights screen** (pulled forward from M4): fixing
  the auto rotation removed the only insight kind that fired for a typical run, leaving every
  checkpoint reading "Nothing notable this stretch". The gap was the insight *catalogue*, not the
  plumbing -- weak-link targeting needs Switch-Everything and chart-override needs an authored chart,
  so between them they covered a minority of runs. Three things closed it:
  - **A fourth kind, `performance-trend`**, measuring team *rates* rather than events: shooting from
    the field and from three, scoring, ball security, the shooting and points allowed, turnovers
    forced, rebounding. Each window is compared against the team's own earlier season, or against the
    league before there is enough of one -- which is what lets the very first stretch of a run say
    something instead of waiting for a baseline. Thresholds and minimum attempt counts keep a cold
    week from reading as a collapse.
  - **Tone.** The first insight kind that is routinely *good news*, which is what "what's working"
    required. Insights that carry no tone are problems by construction, which is true of all three
    possession-log kinds.
  - **A dedicated screen** (`InsightsScreen`, reachable from the run nav), split into what's working,
    what needs work, and the season log. Rates are recomputed from box scores on every render, so the
    screen moves after every game rather than at the checkpoint; events arrive already captured,
    since possession logs are stripped as each game resolves.

  **No new persisted state.** Everything reads `game.result.boxScore`, which is permanent, so a
  window can be recomputed at any time and can never drift from the games it describes. The same
  function runs at chunk close to write the season record the fired epilogue reads.

- **Richer Coaching Insights** (M4) -- **Planned**: the remaining ideas. Four kinds exist now
  (`weak-link-targeting`, `chart-override`, `fatigue-substitution`), and only the first says anything
  about *tactics* rather than rotation mechanics. The possession log already carries everything a
  deeper reading needs -- play call, both fives with slots, outcome, scheme, and now the defensive
  scheme per possession -- so candidates like "your Twin Towers post-ups were the least efficient play
  you ran", "you were out-rebounded on the offensive glass in every loss", or "your closing five was
  outscored in the fourth in three of these games" are all derivable from data already in hand.
  **Scheduled after playoffs (M4) rather than earlier** because insights are most valuable when there
  is a season shape to comment on, and because each new kind needs a matching entry in
  `KIND_PRIORITY` and the run-level phrasing in `describeRunInsight` -- the epilogue inherits every
  kind added here, which is a feature but also the reason not to add them casually.

---

## Tier 17 — Opponent Scouting
**Shipped (M3)**

Seeing what the other seven teams are actually running, so a tactical choice can be aimed at
something rather than guessed. The GM used to know opponents only by their record: rosters, systems
and schemes were all invisible, which meant every pre-game decision was made blind.

- **Opponent lineups and systems** (M3) -- **Shipped**: `ui/screens/TeamScoutScreen.tsx` is a
  read-only report on any team -- offensive system, defensive scheme, starting five, standings
  position, the season series against you, group averages via the same `TeamSummary` My Team uses,
  and a roster listing each player's position, age, height and scouting tags. Reached by clicking a
  team name anywhere one appears: the standings (any team, including your own) and a schedule row's
  abbreviation (the opponent you are about to play). Both go through `ui/components/TeamName.tsx`,
  the sibling of `PlayerName`, over a single `InspectorContext` that now carries `openPlayer` and
  `openTeam`.
- **How much is knowable -- decided and enforced.** Full visibility would make scouting a chore
  rather than a choice (every game acquires homework), and interacts badly with Tier 6's synergy
  being a *hidden* quality of your own roster. So the report reveals **system, scheme, starting five
  and qualitative tags**, and not the attribute sheet. Enforcing that took two changes beyond the
  screen itself, because `PlayerScreen` renders *any* player and scouting reports link to it:
  - **The player page has an opponent mode.** Attribute table, potential, and the hidden
    consistency/clutch/durability/tendency block are all gated to the GM's own roster, as is the
    overall rating -- the one number that ranks a roster at a glance. What stays is identity, tags,
    role and the box-score line, which is what a league can actually see.
  - **Tags have a scouting form** (`scoutingTags` in `ui/playerTags.ts`). Two rules. Tags that
    survive lose the rating quoted in their tooltip -- "Clutch 82", "Durability 85", "110 attribute
    points of room" are hidden even on your own sheet, and handing them over for twelve opposing
    players would have leaked *more* than the attribute table. And the four development tags
    (Rising, Declining, Untapped, Maxed Out) are dropped outright: the first two are a pure function
    of age, which the report already has a column for, and the last two read `development.potential`.
    This one was found by opening the screen -- with them in, they fired on nearly every player and
    the column was mostly describing the opponent's *rebuild* rather than the game.
- **Deeper scouting as a shop purchase** stays available as a later addition, and would give the
  budget another claimant, which Tier 5 wants. Deliberately not built yet: adding a shop card before
  scouting has proved fun is the wrong order.
- **Why M3.** This is the missing half of M3's tactical axis. Switching defensive scheme between games
  already worked, but nothing on screen told you *what to switch to* -- scouting is what converts that
  control from a guess into a decision, and the two are much less valuable apart than together.

---

## Tier 18 — Owner Archetypes & Dynamic Directives
**Planned -- scheduled M4**

Turns ownership pressure from a scalar rank-fraction target into distinct behavioural constraints and win conditions. Today every run is fired for the same reason in the same way; an owner with an opinion makes the *same* record mean different things run to run.

- **Owner personalities** (imposed at run start, rolled alongside Market Size -- Tier 3, design doc Section 8.1):
  - *Impatient Billionaire*: 1.5x Budget, but stretch targets escalate aggressively and veteran playing time is mandated.
  - *Stathead / Efficiency Purist*: requires a high rim-and-three attempt share or a top-tier defensive rating; penalises a mid-range-heavy diet.
  - *Youth Fanatic*: development-first mandate; the firing threshold trips if players 22 and under average under 18 minutes.
  - *Cheapskate Mogul*: earnings halved, but grants +1 season of patience per stretch.
- **Dynamic directives**: mid-stretch mini-mandates ("win 5 of the next 8", "sweep the road trip") paying bonus Budget or a stretch extension.
- **Why M4.** It interacts directly with Tier 12's graduated expectations and the playoff bar -- both change what "success" means, and defining them separately means defining them twice.
- **Note the overlap with existing systems.** Several archetypes are minutes mandates, which is exactly what Tier 3's Homegrown Mandate and Minutes Cap already are, enforced through `run/minutesBudget.ts`. Build these as house rules the owner imposes rather than as a parallel constraint system, or there will be two places that can narrow the same window.

---

## Tier 19 — Tactical Emphasis & Situational Focus Points
**Shipped (M3) -- build notes and the balance measurements in `m3-tactical-axis.md`**

> **Shipped as four dials on `Team.tacticalFocus`** (optional, so an absent focus is byte-identical to
> the game before it existed and every old save loads unchanged): **Pace** (control/push, a possession-
> duration multiplier), **Shot Selection** (rim/threes, scaling the playbook's play-call weights),
> **Tilt** (paint/perimeter, offsetting the scheme's `interiorFocus`), and **Glass** (crash/get back,
> offsetting the offensive rebound rate). Every one is an offset on a quantity the engine already
> computed -- no new resolution logic. Controls sit on My Team, the checkpoint and the simcast, exactly
> where the defensive scheme already does, and `CoachingDirective` is now the D1 discriminated union so
> M6's substitutions and timeouts slot in without touching a sender.
>
> **Only Shot Selection moves synergy**, because it is the only dial that changes the play-call *mix*
> the roster is scored against -- which is what makes its right answer roster-dependent rather than
> universal. A mid-broadcast change carries the recomputed score on the directive, since the engine
> cannot compute one for itself (`computeInitialSynergyScore` lives in `run/`, and `engine/` does not
> import from there); `run/teamSynergy.ts` holds the one formula both paths use.
>
> **Two dials were rebuilt against measurement, and one imbalance turned out not to be a dial problem
> at all.** The Glass dial's cost was inverted -- transition was then the *least* efficient play call
> in the engine, so the "concede fast breaks" cost was a gift -- and Pace's efficiency term had to drop
> 5x once it turned out the volume half of that trade is symmetric. Hunt Threes never actively lost,
> and the cause was correctly diagnosed as the shot model rather than the dial: a mechanism built to
> offset it inside the dial was measured and reverted, and the real fix landed later in the shot model
> itself (see below). Full numbers in `m3-tactical-axis.md`.
>
> **Shipped afterwards -- the shot model was fixed, and the dial became a real decision.** Nothing had
> ever compared play calls against *each other*, and measured over 240 games the engine had the two
> extremes of real basketball inverted: transition was its worst call at **0.917** points per play and
> cutting fifth of six at 1.000, while spot-up led at 1.102. Since `RIM_LEAN` runs along exactly that
> axis, Hunt Threes was buying points for every system. Four causes, all structural rather than tuning:
> transition scored partly off the on-court five's mean **rebounding**; transition was defended by
> `pickBest(defense, speed)`, so a fast break faced the opponent's *quickest* defender every single
> time -- the one play call always drawing the best available defense, when a break is a break
> precisely because the defense is not set; cutting had **no finishing attribute at all** and was
> treated as a *perimeter* action, so Pack-the-Paint helped cutters reach the rim; and make probability
> was a single `MAKE_PROB_BASE` for every shot in the game, so a play call could only be better than
> another by producing better *players*, never a better *shot*. That last one is now
> `MAKE_PROB_BASE_BY_PLAY_CALL`, which encodes shot location. Result: cutting **1.181**, transition
> **1.143**, spot-up 1.068, pick-and-roll 1.020, post-up 1.000, isolation 0.978, at 222.0 combined
> points against 221.2 before -- the ordering inverted with the scoring level untouched (2PT% 54.5 ->
> 55.8, 3PT% 36.8 -> 34.6, both still inside `scoringCalibration`'s bounds). Swept again paired across
> six systems at 300 games each, **no lean dominates**: rim is best for Balanced Attack and 7 Seconds
> or Less, threes for Twin Towers and Grit and Grind, balanced for Motion and Triangle. `RIM_LEAN` and
> the dial's own costs were **not touched** -- fixing the model was the whole fix. Guarded by
> `engine/playCallEfficiency.test.ts`, which asserts the ordering as a shape rather than as numbers.
>
> **AI teams carry dials too**, derived from their offensive system rather than rolled (rolling would
> have drawn from `rng` and invalidated every seed in the suite). Five of nine systems get a lean; the
> scouting report shows it.

> **This tier *is* Tier 13's level 2, not a separate piece of work, and it introduces *offensive focus* as a layer distinct from the drafted system.** Tier 13 defines level 2 as
> "changes affecting only future possessions -- defensive scheme, focus points, play-call emphasis",
> which is this tier's whole contents. Listing both as M3 line items double-counted one job. The
> mechanism they share already ships: `simulateGameSteps` accepts a `CoachingDirective` through
> `next()`, and mid-broadcast defensive scheme switching is live. What remains is widening that
> directive to a discriminated union, adding an offensive and a defensive focus to `Team`, and
> applying each dial as an offset on a knob the engine already reads.
>
> **Offensive focus is deliberately separate from the drafted offensive system.** The system is fixed
> for a run and is what synergy is scored against; focus is a standing dial changeable any time, like
> the defensive scheme. Folding focus into the system would have made one name mean both a fixed
> identity and a live setting. The resulting model is symmetric: each end of the floor has one
> preset and one live dial. Offensive focus feeds the synergy recompute, which is what keeps it a
> roster-dependent decision rather than a setting with one correct answer.

Granular pre-game and checkpoint levers, giving immediate counter-play against a scouted opponent (Tier 17) without building a full playbook editor.

- **Offensive focus points**: pace control (slow it down vs. push in transition), shot-selection priority (attack the rim / hunt threes / mid-range pull-ups). Modifies play-call selection weights during possession resolution.
- **Defensive aggression toggles**: crash the boards vs. leak out (trades offensive rebound share against transition offense), protect the paint vs. deny the perimeter (modifies resistance against inside and outside shots).
- **Why M3.** It is the bridge between Tier 17 and Tier 13's levels 1-2: scouting reveals *what* an opponent runs, focus points are the dial that exploits it, and Tier 13's directive channel is how a mid-game change reaches the sim. All three are much weaker apart.
- **Reuses machinery that exists.** Play-call weights are already a normalised profile per system (Tier 6) and resistance already reads an interior/perimeter lean per scheme (`SLOT_INTERIOR_LEAN`, `interiorFocus`). A focus point is a modifier over those, not a new model -- which is what keeps this cheap enough to sit in M3.

---

## Tier 20 — Veteran Mentorship & Locker Room Dynamics
**Planned -- scheduled M5**

Gives ageing, low-ceiling veterans a strategic use, alongside the roster turnover that makes them expendable.

- **Mentorship**: pairing a veteran (30+) with a prospect (22 and under) in the same position group accelerates the prospect's gap-closing toward potential at season-end growth.
- **Locker-room traits** (derived player quirks):
  - *Floor General / Vet Leader*: raises team consistency in clutch possessions while on the floor.
  - *Volatile / Locker Room Headache*: high raw talent, but costs synergy or raises variance if bench minutes fall below expectations.
- **Why M5.** It ships alongside Tier 15's retirement and shop signings, and answers the problem those create: once roster spots are scarce and a signing is expensive, an ageing veteran is dead weight unless he does something a young player can't.
- **Decide first, and it is the same open question as Tier 6.5.** "Locker-room traits" are player roles by another name, and Tier 6.5 already parks that whole idea on three unresolved questions (how a trait is assigned, how traits stack, what one mechanically *does*). Answer them once, for both tiers, or this arrives as a second parallel trait system.

---

## Tier 21 — Analytics Suite & Shot Quality Breakdowns
**Planned -- scheduled M7**

Exposes what the possession log already records to a data-minded GM, as compact visual reports.

- **Shot-location efficiency**: eFG% by distance and type (rim, mid-range, three).
- **Lineup efficiency**: point differential per 100 possessions for five-man combinations.
- **Play-call efficiency**: points per possession by play-call primitive (pick-and-roll, isolation, post-up, spot-up, cutting, transition).
- **Why M7.** Pure presentation over data the engine already produces -- the natural launch-prep polish item, and it competes with nothing else for design attention.
- **One real constraint.** Possession logs are stripped as each chunk resolves (Tier 1.5), so anything wanting *possession-level* detail across a season has to capture it as games resolve, the way Tier 16's performance trends deliberately avoided needing to. Lineup and play-call breakdowns are possession-level; shot-location is not, since box scores persist. Decide the capture strategy before building, or the first two reports will only ever cover the current chunk.

---

## Tier 22 — Nemesis Teams & Rivalry Arc
**Planned -- scheduled M4**

Dynamic rivalries generated from what actually happened, reinforcing the Storyteller pillar the design doc names.

- **Triggers**: an opponent beats you in overtime, knocks you out of contention, or sweeps a stretch series against you.
- **Payoff**: custom broadcast commentary lines, raised clutch variance for both sides, and a bonus Budget payout or a consumable for winning a rivalry game.
- **Why M4.** It hooks into Tier 12's playoff bracket and season structure -- elimination is the strongest rivalry trigger available and it doesn't exist until the bracket does.
- **Cheap where it counts.** Broadcast commentary is already a data-driven line selector, and `League.seasonHistory` already retains per-season standings, so "who has beaten you and when" is derivable rather than new state.

---

## Parked

Raised and worth doing, but not scheduled. Grouped by the problem each one solves rather than by
feature area. Nothing here blocks the Build Order; revisit after M2, when playtest feedback says
which problems are real.

**Two of these have sequencing consequences and shouldn't sit here quietly** — see the callouts.

### Retention and replay

- **Cross-run meta-progression.** Already in Tier 9 as an idea, and there's an argument for promoting
  it: in a roguelite, meta-progression is often the biggest single lever on whether someone plays run
  6 or stops after run 1. Right now getting fired is a strong beat but nothing carries forward except
  what the player remembers. Even a thin version — one new system, quirk or cosmetic unlocked after a
  first fired-out run — gives a reason to come back after a bad ending.

  **The counter-argument is already recorded in Tier 9 and still stands:** it may not be needed if the
  shop pool alone provides enough variety, and it would be the *only* thing that persists across runs,
  which cuts against the "bounded runs, no ongoing save" pillar. Worth deciding with M2 data rather
  than on instinct — if playtesters stop after one or two runs, that settles it.

- **Shareable seeds / weekly challenge.** Everyone gets the same imposed variation (quirk, house rule,
  market size, wildcard rolls) and compares outcomes. **Cheaper than it looks:** the engine is already
  seed-deterministic by design — `createSeededRng` exists and seed-reproducibility has been a
  constraint throughout — so the work is seeding *run creation* (which currently uses `defaultRng`)
  and surfacing the seed, not making the sim reproducible. Pairs with Tier 9's local leaderboard.

  Honest caveat: with no backend, "compare outcomes" means players posting results themselves. That's
  the intended low-cost reach mechanism rather than a limitation, but it only works if there are
  enough players to compare against — so it's a post-audience feature, not a launch one.

- **Shareable run recap card** — screenshot-shaped end-of-run summary: stretches cleared, best win,
  seasons survived, what got you fired.

  > ⚠️ **This is not really a parked item — it's an M1 design input.** Tier 8's run-end summary is
  > being built at M1 anyway. Whether it's *screenshot-shaped* is nearly free if decided while
  > building it, and a rewrite if retrofitted later. Decide the shape at M1 even if the sharing
  > affordance itself waits.

### Feel and comprehension

- **Shipped — duplicate player names.** Spotted during M1.5 verification: one roster carried two
  different players both called *Xavier Ellery*, alongside four Codys and three Xaviers. Not bad
  luck — 20 first names by 20 last gave 400 combinations for a league's ~96 players, which the
  birthday maths puts at about eleven expected collisions. Fixed by drawing against a set of names
  already taken, threaded through the whole league (opponents appear in scouting and player pages, so
  per-roster uniqueness would not have been enough), and by widening both pools to 40 for 1600
  combinations, which also stops first names repeating four times in a twelve-man roster. Rolls
  first and falls back to a deterministic walk of the name space, so the work is bounded rather than
  left to chance.

- **Audio.** Completely absent today — there is no audio infrastructure of any kind. Named here so it
  doesn't fall through the gap rather than because it should happen soon. The simcast is the obvious
  hook: a buzzer, a whistle on a foul, a crowd swell on a big shot, all driven by possession outcomes
  the log already carries. High feel-per-unit-effort at this stage. Note browser autoplay policies
  need a user gesture before anything can play.

- **Onboarding / tutorial.** Also absent — no tooltips, no first-run guidance. The roguelite framing
  will pull in players who've never touched a possession-log sim and have no idea what a synergy score
  or an out-of-position penalty means. The Draft and Chart Editor screens are where that bites hardest.

  > ⚠️ **Sequencing note.** The argument that this protects playtest feedback from "I didn't understand
  > what I was doing" is real, but it applies to a *public* audience more than to M2. A private
  > playtest of 3-5 people can be briefed verbally, and their confusion is itself useful signal about
  > where onboarding is needed. So: don't block M2 on this — but do take notes during M2 on exactly
  > what needed explaining, and build from those notes rather than from guesses. Before M7, not before
  > M2.

### Steam-readiness and quality of life

- **Achievements.** Trivial to add late and a natural wrapper around the stretch-clearing escalation
  that already exists. Tier 10's Steam step already plans a swappable interface for leaderboards; the
  same pattern covers achievements.

- **Delegation / auto-handling.** A run repeats the same decision types across many seasons, and by
  season 3 of a stretch that risks decision fatigue. Worth knowing that **partial delegation already
  exists**: unfilled chart time falls through to the coach heuristic, `rotationMinutes` is an
  auto-fallback for everything uncharted, and Sim Season / Sim Stretch already skip the per-game flow.
  The genuine gaps are shop purchases and chart authoring — an "apply last season's chart" or "spend
  the budget sensibly" escape valve, not a new system.

- **Mod support / custom rosters.** Recognised as valuable by the audience (direct comps advertise it),
  but real scope for a solo dev. Note there's no import/export of any kind today — the save is a single
  IndexedDB blob — so this starts with serialisation work. Tier 12's league configuration is a partial
  prerequisite. Only if playtesting shows demand, and not before M4/M5.

### Deliberately not doing before 1.0

Recorded so they stay decided rather than getting relitigated:

- **Multiplayer / pass-and-play.** Established competitors own that space, and the differentiation here
  is the run structure, not social or league features. Protecting scope around that is worth more than
  feature parity.
- **A live transaction market.** Already parked post-launch in Tier 15, and only with real demand. The
  chosen shop-based acquisition covers the need it would serve.

---

## At a Glance

| Tier | What | Status | Milestone |
|---|---|---|---|
| 0 | Core simulation (incl. roster talent ladder) | Shipped | — |
| 1 | Run structure (target/fired/escalate) | Shipped / difficulty pass planned | M2 |
| 1.5 | Season chunking (checkpoints + mid-season rotation/focus decisions) | Shipped | — |
| 2 | Playable UI loop | Shipped | — |
| 3 | Imposed variation (quirks/rules/wildcards/market) | Shipped | — |
| 4 | Drafted variation | Shipped | — |
| 5 | Economy (Budget) | Shipped | — |
| 6 | Systems & synergy | Shipped | — |
| 6.5 | Player roles & team specializations | Idea, unscoped | — |
| 7 | Shop, camps, upgrades, consumables | Shipped | — |
| 7.5 | Live playback (simcast) | Shipped (incl. M1 pacing + 0.75x, mid-broadcast player card) | — |
| 7.6 | Rotation charts & lineup control | Shipped / tuning + paint mode planned | M3, M7 |
| 7.7 | Detailed simcast (labeled court view, player/ball movement) | Planned, unscheduled | after Tier 13 |
| 8 | Run-end summary | Shipped | — |
| 9 | Leaderboard / unlocks | Planned / Idea | post-launch |
| 10 | itch.io → Electron → Steam | Planned | M7 |
| 11 | Simulation fidelity (defensive stats, in-sim rebounds) | Shipped | — |
| 12 | Season structure (league config, playoffs, expectations) | Planned | M4, M5 |
| 13 | In-game decisions (timeouts, subs, schemes, matchups) | Planned | M3, M6 |
| 14 | Risk & attrition (injuries, foul trouble) | Planned, needs design | M5 |
| 15 | Roster turnover (retirement, poaching, shop signings) | Planned / trades post-launch | M5 |
| 16 | Legibility & comprehension (per-game insights, schedule records, performance trends, Insights screen, compact screens + broadcast pass) | Shipped / descriptive cards planned | M4, M7 |
| 17 | Opponent scouting (lineups, systems, schemes) | Shipped | M3 |
| 18 | Owner archetypes & dynamic directives | Planned | M4 |
| 19 | Tactical emphasis & focus points | Shipped | M3 |
| 20 | Veteran mentorship & locker room | Planned | M5 |
| 21 | Analytics suite & shot breakdowns | Planned | M7 |
| 22 | Nemesis teams & rivalry arc | Planned | M4 |
| — | [Parked](#parked) — meta-progression, seeds, audio, onboarding, achievements, delegation, mods | Raised, not scheduled | revisit after M2 |
