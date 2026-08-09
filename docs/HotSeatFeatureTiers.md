**Project:** Hot Seat (roguelite spinoff of Hoop Sim)
**Repo:** [KingForADay933/hot-seat-roguelite](https://github.com/KingForADay933/hot-seat-roguelite) (private)
**Companion doc:** [[Roguelite-Basketball-GM-Design-Document]] -- vision, rationale, open questions. This doc is the flat feature/status catalog; that one is the "why."
**Parent-project doc:** `Basketball Manager Game - Design Document.md` -- Hoop Sim's own design doc, which owns everything in `engine/`. Tier 0 is a port of what it describes.
**Deep dives:** `rotation-charts.md` (Tier 7.6) covers the clock rewrite and lineup control in detail. `detailed-simcast.md` (Tier 7.7) is the planning doc for the labeled-court-view simcast, not yet built.

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

Estimates are **focused working days**, not calendar time — multiply by your own availability. The
list totals roughly 65–100 days: at two solid days a week that's 8–11 months, at four it's 4–6.

| Milestone | Contents | Tiers | Days |
| --- | --- | --- | --- |
| **M0 — itch page** | Store copy, screenshots, a simcast GIF. Created as a **draft, not published**. Copy drafted in `itch-page-draft.md`. | — | 1 |
| **M1 — Complete run** ✅ | ~~Simcast pacing~~ · ~~chronological game order~~ · ~~rebounds in-sim + defensive stats~~ · ~~run-end summary~~ — **complete** | 7.5, 1.5, 11, 8 | 10–14 |
| **M2 — First playtest** | Share privately with 3–5 people; first real difficulty pass; sets the price/scarcity targets for M5 | 1, 15 | 3–5 + ongoing |
| **M3 — Tactical axis** | In-game decisions tiers 1–2 (scheme/focus switching) · position-fit tuning | 13, 7.6 | 8–12 |
| **M4 — Season arc** | League structure & conferences · playoffs bracket · graduated expectations | 12 | 12–18 |
| **M5 — Roster turnover** | Injuries · foul trouble · retirement, backfill & poaching · shop-based signings · run-configuration toggles | 14, 15, 12 | 21–32 |
| **M6 — Live coaching** | In-game decisions tiers 3–4 (substitutions, matchups, timeouts) | 13 | 15–20 |
| **M7 — Launch prep** | Paint mode · polish · page finalization and publish | 7.6, 10 | 5–8 |

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

---

## Tier 7 — Shop & Spending
**Shipped -- Phases 7-9**

Spends the Budget that's been accruing since Tier 5.

- **The shop** (Phase 7) -- **Shipped**: a tier grants *purchase power* per visit, not a curated player list -- condensed tier (every season) allows 1 single-player camp buy; expanded tier (stretch-clear) allows 3 player-camp buys plus 1 whole-team-camp buy. The GM can send **any** active roster player to camp, not a rolled subset -- see design doc Section 8.4. Rerolls returned with Phases 8-9 as predicted: camps have none (nothing to reroll once player choice is free), while coaching upgrades and consumables each get their own independent free reroll on the expanded tier, since those stay randomly rolled.
- **Camps** (Phase 7) -- **Shipped**: pay to send a player (or the whole team, pricier, smaller boost per player) to camp for a bounded-random-*magnitude* boost to a GM-*chosen* attribute -- not a rolled chance at whatever the game decides is optimal. Same bounded-shift mechanic as Tier 3's wildcard breakout, but both *who* and *which attribute* are deliberate choices now (design doc Section 8.5). Also recomputes `Team.synergyScore` from the camp-boosted roster's fit to the drafted system.
- **Coaching upgrades** (Phase 8) -- **Shipped**: a persistent pool of 9 named cards, each a one-time permanent nudge to one rating or attribute the simulation already reads -- the same flat-shift mechanic as roster quirks and wildcard events, just GM-purchased instead of imposed. All nine from the first-pass list built: Clutch Gene, Iron Man Program, Film Study, Players' Coach, Defensive Coordinator, Steady Hand, Player Development Guru, Bench Mob Mentality, System Guru. One-per-run (the pool is exclusion-filtered by what's already owned when rolling offers), acquired through a rolled-offer-plus-reroll flow. The two synergy-flavored cards (Players' Coach, System Guru) are re-added on top of the roster-fit score every time synergy is recomputed rather than applied as a one-time mutation, so a later camp purchase can't silently erase them.
- **Consumables** (Phase 9) -- **Shipped**: cheap, single-season, held in a 3-slot inventory rather than instantly applied -- a pre-season "loadout" step lets the player burn 0-3 before a season, so hoarding for a do-or-die last chance is a real strategy. All seven from the first-pass list built: Sports Psych Session, Load Management, Film Room Marathon, Energy Drink Sponsorship, Extra Shootaround, Defensive Bootcamp, Lucky Jersey. Duplicates are allowed (an item stash, not a one-per-run pool). Effects are applied to *transient* roster/team copies for the season they're burned on, never mutating persisted state, so there's nothing to revert when the season ends -- the effect stops existing once that season's local copies go out of scope. A per-chunk cadence for these (Tier 1.5, instead of pre-season) was raised and parked as a future add-on.
- **Idea, unscoped** -- economy numbers throughout Tiers 5 and 7 (per-win earnings, camp/upgrade/consumable prices, the stretch-clear bonus) are first-pass and flagged in code as needing playtesting to tune. Ties into Tier 1's "too forgiving" variance note.

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
- **Idea, unscoped** -- live lineup editing during the overtime pause. Deliberately not built: injecting a GM's mid-game edit means threading a live mutable channel into what is otherwise a pure, seed-deterministic simulation -- the same `simulateGameSteps` that also runs every AI-vs-AI game with no UI attached. Folded into Tier 13, which has to solve that problem anyway.
- **Deepens into Tier 7.7** -- the labeled-court-view simcast (`detailed-simcast.md`) renders the same possession log this tier already produces; it's an alternate presentation, not a replacement.

---

## Tier 7.6 — Rotation Charts & Lineup Control
**Shipped**

Not part of the original phase plan. A 2K-style rotation chart, and the engine rework it required. Has its own deep-dive doc: `rotation-charts.md`.

- **Real game clock.** The engine was possession-counted with no quarters; it now runs four real 12-minute periods plus uncapped overtime, driven by a clock rather than a loop bound. Possession duration is sampled per play call with outcome adjustments, so **pace falls out of the playbook mix** instead of being an input. Minutes played are summed from real elapsed seconds.
- **Slot-assigned lineups.** The on-court five is `{ player, slot }` rather than a bag of players, so matchups pair slot against slot and a player can be charted somewhere that isn't his listed position.
- **Out-of-position penalty.** Playing someone out of position docks their attributes transiently, for that possession only -- demand-weighted, so a PG at center loses rebounding and interior defense but keeps his passing. Because synergy and projected usage read the same attributes, an out-of-position lineup automatically contributes less and draws fewer touches with no bespoke wiring. Positionless/Specialist quirks are *derived* from height-band overlap and attribute spread rather than stored, so they can't drift out of sync with the player.
- **The chart editor** (My Team): five slot rows by four quarter columns, each cell a timeline of segments. Assign a player or leave Auto; split, merge, and drag boundaries. Live validation surfaces charted minutes per player, double-booking conflicts, out-of-position badges, and projected fatigue at each period's end.
- **Charted spans are law**, with one deviation: a charted player who hits emergency fatigue gets pulled anyway, and the chart resumes once he's genuinely recovered (a 15-point hysteresis band, so a deputy isn't yanked after one possession of rest). Coaching Insights reports a chart override distinctly from an ordinary fatigue sub.
- **Unsatisfiable charts degrade safely.** A chart naming one player in two slots at once used to seat him twice -- four bodies on the floor, and doubled minutes flowing into season development. All five slots are now resolved against the chart before any is applied; a double-booked player wins the first slot that asks and the loser falls through to the coach heuristic.
- **Minutes are a per-position budget.** Each position group shares exactly 48 minutes, 240 team-wide, so raising one player means lowering a teammate at his position. This enforces an invariant the generator already had; a readout above the roster shows each position's allocation.
- **The chart feeds synergy and projected usage** (see Tier 6). Charted spans count exactly; `rotationMinutes` governs Auto time, prorated by how much of that slot's budget the chart hasn't spent. Reduces identically to the old behavior when no chart exists.
- **Planned -- tune the position-fit constants** (M3): the slide and height penalties are first-pass estimates written before any chart existed to exercise them. A GM can now build a real out-of-position lineup, so the thing blocking tuning is gone -- but nothing has been tuned against one. Same for the Positionless/Specialist thresholds, with a known skew: PG and C height bands are narrow and mostly consumed by their single neighbour's overlap, so almost any pure PG or C reads as Specialist by height alone. Watch the synergy knock-on as well as the per-possession effect.
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

Tiers 11-13 below were added after this one and are gameplay work, so despite the higher numbers they come *before* distribution in the Build Order -- numbers are identifiers, not sequence.

---

## Tier 11 — Simulation Fidelity
**Planned**

Deepening what the possession model actually tracks. **Both items below change `PossessionLogEntry`'s shape, which invalidates existing saves with no migration path** -- `isValidBundleShape` rejects rather than migrates, deliberately, on the grounds that nothing has shipped. That's still true, so this is the cheap moment, and it stops being cheap the day there are real players with real runs. Treat them as one unit of work.

- **Shipped -- rebounds during the sim** (M1): `PossessionLogEntry.rebounderId` is set when the miss resolves, using `pickRebounder` -- which already existed in `possession/rebound.ts`, exported and entirely unused. Two things fell out of it: `deriveBoxScore` is now a pure function of the log (it took an `Rng` only for this roll, and no longer needs `playersById` either), and the simcast shows **real rebounds live** -- `LiveBoxScoreLine` was `Omit<PlayerBoxScoreLine, 'rebounds'>` and the REB column rendered a dash for the whole game.
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
| 0 | Core simulation | Shipped | — |
| 1 | Run structure (target/fired/escalate) | Shipped / difficulty pass planned | M2 |
| 1.5 | Season chunking (checkpoints + mid-season rotation/focus decisions) | Shipped | — |
| 2 | Playable UI loop | Shipped | — |
| 3 | Imposed variation (quirks/rules/wildcards/market) | Shipped | — |
| 4 | Drafted variation | Shipped | — |
| 5 | Economy (Budget) | Shipped | — |
| 6 | Systems & synergy | Shipped | — |
| 6.5 | Player roles & team specializations | Idea, unscoped | — |
| 7 | Shop, camps, upgrades, consumables | Shipped | — |
| 7.5 | Live playback (simcast) | Shipped (incl. M1 pacing + 0.75x) | — |
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
| — | [Parked](#parked) — meta-progression, seeds, audio, onboarding, achievements, delegation, mods | Raised, not scheduled | revisit after M2 |
