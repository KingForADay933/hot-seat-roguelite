# Rotation Charts — groundwork

Planning notes for a 2K-style rotation chart: a per-quarter timeline where the GM maps out exactly
who is on the floor, when, and for how long. This document records what the engine does today, what
has to change, in what order, and the decisions already settled.

Written against master as of the simcast (#8) and team-reveal/system-fit (#9) merges. Every phase in
Section 6 is now done -- Sections 1-2 below describe the possession-counted engine those phases
replaced, and are kept as the historical record of why the clock and pace changes were needed, not as
a description of the engine as it stands today. The same goes for each phase's own writeup: they
record what was true when that phase landed.

This is the deep-dive doc for the rotation feature specifically — it corresponds to **Tier 7.6** in
`HotSeatFeatureTiers.md`, which is the project-wide feature catalog and build order. The rotation
follow-ons still open (penalty tuning, paint mode) are listed there as well as in Section 8 below.
`Roguelite-Basketball-GM-Design-Document.md` is the "why" doc behind both.

---

## 0. Fix first: synergy goes stale when minutes change — **fixed, see Phase 0**

Not part of the rotation chart, but it has to be fixed before one is built, because a chart is a far
bigger minutes change than nudging a single slider. Kept in the present tense below as the record of
what the bug was; the fix is Phase 0 in Section 6.

`computeInitialSynergyScore(playbook, roster, rotationMinutes)` is **minutes-weighted**.
`systemDraft.ts`'s `availability()` turns each player's rotation minutes into the weight used for
his share of every role, so who plays how much genuinely moves the team's synergy score.

Measured, on a generated roster under Twin Towers:

| Minutes allocation | Synergy |
| --- | --- |
| As generated | 79 |
| Everyone equal (24 min) | 81 |
| Depth chart inverted | 84 |

A 5-point swing is ~2% of offensive strength (`SYNERGY_MULTIPLIER_FACTOR` is 0.4%/point).

**But `setRotationMinutes` never recomputes it.** Synergy is written in exactly two places:
`lockSystem` at draft time, and `teamsWithRecomputedSynergy`, which is only called from
`buyPlayerCamp` / `buyTeamCamp` / `buyCoachingUpgrade`. So after any rotation edit the stored
`synergyScore` is stale until the GM happens to buy something in the shop.

This is visible on one screen: `MyTeamScreen` renders `team.synergyScore` a few sections above the
minutes inputs that should be feeding it. Making minutes editable at any time widened the window
considerably — it used to be reachable only at checkpoints.

Fix is small: have `setRotationMinutes` route through the same recompute (plus
`computeSynergyUpgradeBonus`, which must be re-added every time — see its doc comment).

## 1. What the clock is today

**There isn't one.** There are also no quarters.

`simulateGameSteps` runs regulation as a *single* period of `possessionsPerGame` possessions:

```ts
yield* runPeriod(possessionsPerGame, rollJumpBall(rng))
```

Everything time-shaped is derived after the fact from a possession index:

| Concept | How it's produced today | Where |
| --- | --- | --- |
| Quarters | `Math.ceil(possessionNumber / (possessionsPerGame / 4))` — a display label only | `simulateGame.ts` `getPeriodLabel` |
| Minutes played | `(possessionsOnCourt / possessionsPerGame) * 48` | `boxScore.ts` **and** `simcast/playbackState.ts` |
| Clutch time | last 5% of the period's possessions, margin ≤ 5 | `possession/variance.ts` `isClutchTime` |
| Fatigue | flat gain/recovery per possession | `rotation/fatigue.ts` `tickFatigue` |
| Substitutions | evaluated every possession | `rotation/substitution.ts` |

Note the minutes formula now has **two** consumers. `playbackState.ts` re-derives minutes live for
the simcast box score using the same expression, so a clock change has to land in both or the live
box score will disagree with the official one at the buzzer.

The good news: the possession log already carries `homeOnCourtIds` / `awayOnCourtIds` on every
entry and is the sole source of truth for who was on the floor — for `deriveBoxScore` and now for
the simcast's live fatigue replay too. Adding elapsed time to that record is a natural extension.

## 2. Pace doubles (settled)

`possessionsPerGame` defaults to **100** *total* — offense strictly alternates, so each team gets
**~50 per game**. The real NBA is ~100 per team.

Points-per-possession is already realistic (~1.2 PPP, which is where the observed ~61 ppg comes
from). The possession *model* is fine; there are simply half as many possessions as a real game.

This blocks a realistic clock outright:

```
2880 seconds of regulation / 100 total possessions = 28.8 s per possession
```

Longer than a 24-second shot clock. Doubling to ~200 lands everything at once:

```
2880 / 200 = 14.4 s per possession    → realistic
~100 possessions/team × ~1.2 PPP      → ~115 ppg, realistic, no scoring re-tune needed
```

The code change is one default. The costs:

- **Fatigue and rotation constants.** All possession-denominated and tuned against 100. `constants.ts`
  says so outright — an 18-possession shift is "~8.6 minutes at the default 100-possession pace",
  which becomes ~4.3 minutes at 200. Affects `FATIGUE_GAIN_BASE`, `FATIGUE_RECOVERY_BASE`,
  `MIN_SHIFT_POSSESSIONS`, `PACE_CHECK_MIN_POSSESSIONS`. End state: redenominate in seconds.
- **Simcast pacing.** `BASE_POSSESSION_MS` is 900, tuned so "1x runs a ~100-possession game in about
  a minute and a half". Doubling possessions doubles that to three minutes. Halve it to ~450 to keep
  the same wall-clock feel, or accept a longer broadcast.

## 3. The position-locked invariant is what we're removing

Today the on-court five is always exactly one per position, by construction:
`checkSubstitutions` only considers bench players whose `positions[0]` matches the outgoing player's.
`buildMatchups` then sorts both fives by position and pairs by index. `applyYouthMovement` preserves
the same invariant deliberately.

Free-form fives (Decision 2) remove this. The replacement that makes it tractable:

> **The chart's slot becomes the authoritative position.** A player charted into the C slot guards
> the opposing C slot and is evaluated as a C, regardless of what `positions[0]` says.

AI teams (no chart) get slot = `positions[0]`, exactly today's behavior.

**The load-bearing refactor** is therefore that on-court state stops being a bag of players:

```ts
RotationState.onCourt: Player[]  →  { player: Player, slot: Position }[]
```

That ripples into `findAtPosition`, `checkSubstitutions`, `buildMatchups`, the possession log's
on-court ids, the simcast's `OnCourtPanel`, and the UI's `splitRoster`. Biggest single code change
in the feature; worth doing alone, before any penalty math or UI.

## 4. Positional versatility (Decision 2)

### The raw material already exists

**Height ranges**, from `randomPlayer.ts`:

| Position | Range | |
| --- | --- | --- |
| PG | 72–76" | 6'0"–6'4" |
| SG | 74–78" | 6'2"–6'6" |
| SF | 77–81" | 6'5"–6'9" |
| PF | 80–84" | 6'8"–7'0" |
| C | 82–88" | 6'10"–7'4" |

These validate the intuition directly. A 6'9" SF is 81" — inside PF's range, one inch under C's
floor, so PF is free and C is a mild stretch. A 6'3" PG is 75", two inches below SF's floor, so that
slide bites.

**Position is single-valued in practice.** `Player.positions` is typed `Position[]` but
`generatePlayer` always emits one entry. Affinity has to be derived, or generation starts emitting
real secondary positions.

### `PLAY_CALL_MODELS` is a better fit basis than `POSITION_BIAS`

PR #9 added `run/variation/possessionRoles.ts`, which is a structural mirror of how a possession
actually resolves. Per play call, per role, it pairs:

- `selectionScore` — mirrors `playerSelector.ts`'s `score*` functions, i.e. *who executes the role*
- `contribution` — mirrors that role's share of `computeOffenseStrength`, i.e. *offense-strength
  points that player puts on the possession*

This is a far better basis for the attribute-fit component of the penalty than scoring against
`POSITION_BIAS`, because it is what the engine literally does rather than a parallel guess at what a
position "needs". `systemDraft.ts` already builds the whole projection stack on top of it —
`roleUsageShares`, `expectedPlayCallStrength`, `computeProjectedUsageShares` — reusing the engine's
own `USAGE_WEIGHT_EXPONENT` so the two cannot drift.

**Maintenance coupling to respect:** `possessionRoles.ts` states that if `playerSelector.ts` or
`possessionStrength.ts` change, the matching half there must change with them. Phases B and C touch
possession resolution, so this file is on the blast radius.

### Where the penalty applies

**As a transient effective-attribute shift**, not a new term threaded through the sim. Everything
downstream — `computeOffenseStrength`, `computeResistance`, `playerSelector`'s scorers,
`rotationValue`, *and* `possessionRoles`' `selectionScore`/`contribution` — reads `player.attributes`
directly. Handing the possession an adjusted `Player` propagates the penalty everywhere with zero
call-site changes.

That last item is the payoff and it is worth being explicit about: because synergy and projected
usage are computed through the same role functions, an out-of-position player **automatically**
contributes less to synergy and draws fewer projected touches. The chart's cost shows up in the
team's synergy score without a single line of bespoke wiring.

The named precedent is now `run/chunkSimContext.ts` — `createChunkSimContext` folds active
consumables into sim-only roster/team copies that are "never written back to the bundle". Same
pattern, narrower scope.

Two rules:
- Never persisted, never recomputes `overallRating` (display-only, and the sim is barred from it).
- **Demand-weighted, not uniform** — dock what the new slot leans on. A PG at C loses rebounding and
  interior defense, not passing.

### Player quirks — derive, don't store

**Do not add a `Player.quirks` field.** PR #9's `ui/playerTags.ts` already set the house position:

> There is no per-player quirk field in the data model -- PlayerHiddenTraits and PlayerDevelopment
> already *are* the per-player variation, they were just never surfaced anywhere. This file names
> them [...] without inventing a parallel system the simulation doesn't read.

Positionless and Specialist should follow suit and be derived:

- **Positionless**: height sits inside more than one band, attribute profile balanced rather than
  spiked. A genuinely 6'7" player with no glaring hole *is* positionless; nothing needs writing down.
- **Specialist**: height at the extreme of a single band, or a sharply spiked attribute profile.

No schema change, so no save breakage, and it cannot drift out of sync with the player.

The one real difference from `playerTags`: these must be **read by the simulation**, so the
derivation belongs in engine code with a display layer on top, not in `ui/`. Reconcile the vocabulary
so a GM doesn't meet one set of names on the reveal card and another on the chart.

---

## 5. Other coupling worth knowing

- **No dead balls.** Subs are evaluated every possession; a chart implies subs at stoppages.
- **Development is downstream.** `aggregateSeasonMinutes` feeds `dpFormula`, so the chart directly
  drives who develops. Chart mistakes compound across a season.
- **`rotationMinutes` becomes the Auto fallback** and stays the only input AI teams need. It also
  remains a synergy input (§0), so a chart must feed the same recompute. Since Phase I it is also a
  per-position budget rather than a free number per player (`run/minutesBudget.ts`).
- **Consumers taking `possessionsPerGame`:** `deriveBoxScore`, `getPeriodLabel`,
  `computeOvertimePossessions`, `isClutchTime`, `generateCoachingInsights`, `ChunkSimContext`,
  `playbackState`, `useSimcastPlayback`.
- **Saves break on any possession-log change.** `isValidBundleShape` rejects rather than migrates.
  Nothing has shipped, so this has been the cheap moment for those changes — it stops being cheap the
  day there are players. Deriving quirks rather than storing them (§4) means Phase E needs no schema
  change at all.

### The simcast hook for Decision 5

`useSimcastPlayback` already has the state machine the overtime prompt needs — `status` is
`'playing' | 'paused' | 'final'`, and an `'awaiting-substitutions'` state pauses the interval the
same way `'paused'` does. The generator's laziness is deliberate and documented for exactly this:

> the possessions past the cursor genuinely haven't happened yet, which is what leaves room for the
> GM to change something mid-game later

Two gotchas:
- **`SimulationStep` carries no period marker.** It's `{ entry, homeScore, awayScore }`; the period
  is re-derived by `getPeriodLabel`. Detecting "overtime just started" means diffing labels, which is
  fragile. Phase A should put the period on the step directly.
- **`skipToEnd` drains the generator synchronously** in a `while` loop. It has to either bypass the
  prompt or resolve it non-interactively, or it will deadlock against a prompt that needs input.

---

## 6. Build order

The pivot underneath all of this: **possession-counted game → clock-driven game**.
`for (possession of 1..100)` becomes `while (clock > 0)`, and possessions per game stops being an
input and becomes an outcome.

### Phase 0 — Recompute synergy on rotation change — **done**
§0. `setRotationMinutes` (`RunProvider.tsx`) now routes through the same `teamsWithRecomputedSynergy`
the camp and coaching-upgrade purchases use, recomputing on top of the just-edited teams rather than
the stale pre-edit bundle, and re-adding `computeSynergyUpgradeBonus` as that helper's doc comment
requires. The number on My Team no longer goes stale the moment a GM touches a minutes box.

### Phase A — Real periods — **done**
`simulateGameSteps` runs four actual `REGULATION_PERIODS`, each with its own `rollJumpBall`, plus
untapped overtime periods beyond that. `getPeriodLabel` is now a straight lookup on the period the
possession was actually played in, and `PossessionLogEntry.period` is what the simcast (`playbackState.ts`)
reads for its label rather than diffing anything.

### Phase B — Possession duration model — **done**
`possession/possessionDuration.ts` samples each possession's length in seconds off
`POSSESSION_DURATION_BANDS`, conditioned on the play call, with outcome adjustments (`TURNOVER_DURATION_FACTOR`
truncates early, `REBOUND_SECONDS` / `SECOND_CHANCE_DURATION_BAND` add scramble time after a miss).
Landed at `NOMINAL_POSSESSION_SECONDS` ~16.6s rather than the originally-targeted 14.4 -- close
enough that pace genuinely falls out of the playbook mix as intended, just calibrated against a full
generated league instead of hand-picked band midpoints (see that constant's doc comment).

### Phase C — Clock-driven loop — **done**
`runPeriod` counts a real clock down (`while (clock > 0)`) instead of a possession count; fatigue is
denominated in seconds (`FATIGUE_GAIN_PER_SECOND` / `FATIGUE_RECOVERY_PER_SECOND`); minutes are summed
from elapsed seconds in both `boxScore.ts` and `playbackState.ts`. `BASE_POSSESSION_MS` retuned to 450.

### Phase D — Slot-assigned on-court state — **done**
`RotationState.onCourt` is now `OnCourtPlayer[]` (`{ player, slot }`). `buildMatchups` pairs slot
against slot, `findAtSlot` replaces `findAtPosition`, and a substitution hands the *slot* to the
incoming player rather than re-deriving it from them. `slotByPosition` builds the assignment from
each player's own position — the fallback every chartless team, including all seven AI teams, will
keep using.

Verified behavior-neutral by fingerprinting a seeded 12-game slate before and after: identical
scores and identical play count.

The possession log stores the slots too: `homeOnCourt` / `awayOnCourt` are `OnCourtRecord[]`
(`{ playerId, slot }`) rather than id arrays. `generateCoachingInsights` replays the assignment the
sim actually used instead of reconstructing it from `positions[0]`, and the simcast's on-court panel
shows each player's slot — so an out-of-position lineup will read as what the GM did rather than
looking like a mislabel.

### Phase E — Positional versatility — **done**
`engine/positionFit.ts` implements the penalty as the transient effective-attribute shift §4
describes: `effectivePlayer(player, slot)` returns the player unchanged when `slot === positions[0]`
(every slot in the game today, since no chart exists yet to disagree), and otherwise a shallow copy
whose attributes are docked by

```
severity = (POSITION_FIT_SLIDE_PENALTY_PER_SLOT * slotSlideDistance + POSITION_FIT_HEIGHT_PENALTY_PER_INCH * heightMisfitInches) * quirkMultiplier
dock[attribute] = severity * demandWeight(attribute, slot)
```

`demandWeight` splits the ten attributes into an interior group (insideShot/rebounding/interiorDefense/vertical)
and a perimeter group (the other six), and weights each by `SLOT_INTERIOR_LEAN[slot]` -- 0 at PG, 1
at C, interpolated in between -- so a PG slid to C docks only the interior group (passing, ballHandling
etc. survive untouched) and a slide to SF docks both groups by half. This is the "demand-weighted, not
uniform" rule from §4, derived from the engine's own interior/perimeter split (`avgInteriorDefense`/
`avgPerimeterDefense` in `matchup.ts`) rather than a new hand-authored table -- deliberately simpler
than routing through `PLAY_CALL_MODELS`, which has no notion of slot to hang a demand weight off of;
see the open questions below for why that's a placeholder rather than the last word.

Positionless/Specialist are derived (never stored) from height-band overlap and attribute spread --
`isPositionless`/`isSpecialist` in the same file -- and feed back into `quirkMultiplier`: 0.5x for
Positionless, 1.5x for Specialist, 1x otherwise. `ui/playerTags.ts` wraps the same two functions for
the team-reveal card, satisfying §4's "reconcile the vocabulary" note.

Wired into `simulateGame.ts` at the one call site that needed it: `runPeriod` builds `offenseFive`/
`defenseFive` through `effectiveFive` before handing them to `selectPlayers`, `computeOffenseStrength`,
`computeResistance` and `offensiveReboundProbability`, exactly as §4 predicted -- no other call site
changed. Rotation state, fatigue and the possession log still read the real (unshifted) players.
Verified behavior-neutral: the full test suite (389 tests, up from 361) passes unchanged, since every
slot in real gameplay still equals `positions[0]` until Phase F/G exist.

### Phase F — Rotation plan data model — **done**
`data/types/team.ts` adds exactly the shape sketched here: `RotationPlan` is
`Partial<Record<period, Partial<Record<slot, RotationSegment[]>>>>`, and `Team.rotationPlan?` is
optional -- absent for every AI team and for a user team before a chart exists, which is every team
in the game today (no editor to write one yet). `RotationSegment.startSeconds`/`endSeconds` are
seconds into the period, matching the period clock itself rather than the whole-game elapsed clock,
so a chart's Q1 and Q3 segments both start counting from 0.

No migration needed: `runRepository.ts`'s `isValidBundleShape` only checks `teams` is an array, never
a per-team shape, so an optional field a saved `Team` may or may not have needed no schema bump.

`engine/rotation/rotationPlan.ts`'s `chartedPlayerId(plan, period, slot, secondsIntoPeriod)` is the
whole evaluation: no plan, no entry for this period/slot, a gap between segments, and an explicit
`{ kind: 'auto' }` segment all collapse to the same `null` ("Decision 3: unfilled time is implicitly
Auto"), so `checkSubstitutions` (`substitution.ts`) only has one branch to add. Per on-court slot, it
asks the chart first; a non-null answer is law -- forced in immediately, bypassing the fatigue/pace
heuristic entirely, *including* leaving an exhausted charted player in (deviation handling for that
is Phase H, not this). Only `null` falls through to today's heuristic, unchanged -- which is what
keeps every AI team and every un-charted user team behavior-neutral: verified by the full suite (402
tests, up from 389) passing with no team anywhere setting `rotationPlan`.

`checkSubstitutions` grew two new parameters (`period`, `secondsIntoPeriod`) to make that lookup
possible; `simulateGame.ts`'s two call sites compute `secondsIntoPeriod` as `periodSeconds - clock`,
the same period-relative value `getPeriodLabel` and the clock display already key off.

**Deliberately not done here:** `systemDraft.ts`'s `availability()` still approximates from
`rotationMinutes` rather than reading a chart exactly, as this section originally floated. Left alone
because there was no way yet to construct a real chart to approximate *instead of* -- every plan in
existence at the time was a synthetic test fixture.

**That blocker is now gone** (Phase G shipped the editor), and Phase J below does the work.

### Phase G — The chart editor — **done**
Lives in `MyTeamScreen` as planned, as a new "Rotation Chart" section alongside (not replacing) the
existing minutes/focus table -- Phase F already decided `rotationMinutes` stays the Auto-fallback and
synergy input, so both controls are live at once, one govern the charted spans and the other governs
everything else.

Five slot rows (`RotationChartEditor.tsx`) by four period columns (`CHARTABLE_PERIODS` --
regulation only; overtime is a live simcast prompt per Decision 5, not something authored ahead of
time). Each cell is a `TimelineBar` rendering that slot/period's segments (`run/rotationChart.ts`'s
`getSegments`, which reads a real plan or defaults to one Auto span covering the whole period).

**Boundaries move by drag, as planned** -- pointer capture on a thin handle between two segments,
position converted from `clientX` back to seconds against the bar's own bounding rect
(`moveBoundary`, clamped to `MIN_ROTATION_SEGMENT_SECONDS` on each side so a drag can't collapse a
span to nothing). **Creating a new boundary is "Split in two" (bisect, same fill on both halves)
rather than click-to-cut at an arbitrary point** -- simpler to get right than inferring where on a
30px-tall bar a GM meant to cut, and dragging the resulting boundary afterward reaches the same place.
"Merge with previous/next" is the inverse, removing a boundary and keeping the earlier segment's fill.
Clicking a segment selects it and opens an assignment panel: a select (Auto, plus the roster in the
same starters-then-bench grouping `CampPurchaseForm` already established) and the split/merge
controls, all editing the same plan `checkSubstitutions` already knows how to read.

Edits are optimistic and local except for the drag case: every discrete action (fill change, split,
merge) calls `onSetRotationPlan` immediately, same as `MinutesInput`/`TrainingFocusSelect` elsewhere
on this screen, but a drag updates local state on every `pointermove` and only persists on
`pointerup` -- otherwise a single drag gesture would be an IndexedDB write per pixel of mouse
movement.

**Live validation, against the doc's list:**
- *Team-minutes total / per-player totals* -- `rotationChartValidation.ts`'s
  `chartedMinutesByPlayer` sums charted (non-Auto) seconds per player, shown in a per-player table.
  Deliberately doesn't try to project Auto minutes into that total: what the heuristic will actually
  give an Auto span isn't knowable before the game runs.
- *Empty slots*, generalized to a real problem the free-editing-per-slot design actually has: nothing
  stops the same player being named in two slots at once. `doubleBookedConflicts` finds every
  overlapping pair and the summary panel surfaces it in red. **This was originally the only defense,
  and it wasn't enough** -- see Phase I below.
- *Out-of-position penalty badge* -- a small red `!` on any segment where the named player's own
  position doesn't match the charted slot, computed inline with `engine/positionFit.ts`'s
  `slotSlideDistance` (the same function the in-sim penalty uses) rather than a parallel check.
- *Projected-fatigue overlay* -- narrowed from the original idea of an overlay drawn on the timeline
  itself to a Q1-Q4 fatigue-at-period-end row per charted player, reusing
  `engine/rotation/fatigue.ts`'s real gain/recovery formulas over each player's own charted on/off
  spans. Explicitly labeled a floor, not a forecast: any of a player's un-charted time is scored as
  bench rest, since what the live heuristic would actually do with an Auto span isn't known ahead of
  the game.

Verified in-browser (dev server + a scripted Chromium session, screenshots inspected) rather than
with component tests, matching how the rest of the UI layer is verified in this codebase -- there's no
`@testing-library` dependency here, only pure-logic unit tests plus manual/driven verification for
`.tsx`. Confirmed: the grid renders 20 timeline bars (5 slots x 4 periods) against a real generated
roster, segment selection and the fill select work, split produces two segments with the summary
panel's charted-minutes and fatigue numbers updating live, dragging a boundary between two
same-player segments live-redraws without changing their combined total, merge restores one segment,
and assigning an out-of-position player lights up the `!` badge and the summary row for exactly that
player -- zero console errors through all of it. `run/rotationChart.ts` and
`run/rotationChartValidation.ts` additionally carry 32 unit tests of their own.

### Phase H — Deviation and edge rules — **done** (except what's explicitly deferred below)

**Exhausted charted players.** Phase F made a charted segment absolute -- even a player at 100
fatigue stayed in if the chart said so. `checkSubstitutions` (`substitution.ts`) now carves out one
exception: once the charted player's own fatigue reaches `FATIGUE_EMERGENCY_THRESHOLD`, the slot
falls through to the ordinary heuristic instead of honoring the chart, which pulls them (the
emergency threshold already bypasses the heuristic's own shift cooldown) for the best rested
same-position bench player. The deviation isn't a one-shot event -- it's re-derived from current
fatigue on every possession, which gives it a natural lifecycle with no new state needed:

- While the charted player's fatigue stays above `FATIGUE_SUB_OUT_THRESHOLD` (80), the slot keeps
  running on the heuristic, which manages the deputy on their own fatigue/pace terms (including
  subbing the deputy again if *they* get tired -- the slot doesn't get stuck on one deputy).
- Once the charted player actually recovers down to 80, the chart resumes and swaps them back in.

The resume threshold is deliberately 80, not "the instant fatigue dips under 95" -- fatigue recovers
fast enough on the bench that a same-threshold resume would yank the deputy back out after a single
possession of rest, handing the slot right back to someone still nearly as gassed as when they left.
The 15-point gap is real hysteresis, sized off two constants that already existed rather than a new
tunable.

**Surfaced through Coaching Insights, as planned.** `generateCoachingInsights.ts`'s existing
fatigue-substitution replay (it already reconstructs every sub-out from the possession log to build
today's plain "pulled with heavy fatigue" insight) now also checks, for each pull, whether the
outgoing player was actually charted into that slot at that moment (`chartedPlayerId`, the same
Phase F function). When they were, the insight reads distinctly -- "was charted to stay on the floor
but got pulled with emergency fatigue" -- rather than the generic message, so a GM can tell an
ordinary rotation sub from their own chart getting overridden.

**Overtime (Decision 5).** "The normal sim carries the Q4 closing five" needed no engine change at
all -- `RotationState` already persists unchanged across periods, regulation or overtime, so the
closing five was always the default. What Phase H adds is purely the simcast side: a genuine
pause-and-acknowledge moment at the start of each overtime period, per §5's own plan.
`PlaybackState` gained a raw `period` field (`playbackState.ts`) so the transition can be detected
by number instead of diffing the display label, and a new pure `entersNewOvertimePeriod(previous,
next)` says exactly when that transition is a *new* overtime period starting. `useSimcastPlayback`
pulls a step as before, but if it crosses into a new overtime period, holds it in a ref instead of
folding it in and sets status to `'awaiting-substitutions'` -- which stops the interval the same way
`'paused'` does, exactly as §5 anticipated. `acknowledgeOvertimePrompt` folds the held step in and
resumes. `skipToEnd` was patched to fold in a held step first if one exists, rather than silently
losing that possession -- the second of the two gotchas §5 flagged in advance (a prompt requiring
input would have deadlocked skipToEnd's synchronous drain); the fix works because this prompt
requires no input, only acknowledgement.

**Deliberately not built: live lineup editing during the overtime pause.** §5 described the pause
mechanism in detail but never fully specified how a substitution decision made there would reach the
engine, and building that -- a way to inject a GM's edit into a `RotationState` owned by a running
generator's closure -- is a materially bigger, riskier change than the prompt itself: it would mean
threading a live mutable channel into what is otherwise a pure, seed-deterministic simulation (the
same `simulateGameSteps` that also runs every AI-vs-AI game with no UI involved at all), plus real UI
for picking a five mid-broadcast. Since Decision 5's default (closing five carries over) is already
what happens with zero intervention, the prompt's job is only to give the GM a beat to notice
overtime started, not to block on a decision the sim can't proceed without -- which is exactly what
got built. Revisit if a real want for in-the-moment overtime substitutions shows up.

**Explicitly out of scope, per this section's own "later":** foul trouble and injuries. Neither
system exists in the engine at all yet -- there's no personal-foul accumulation or foul-out state,
and no injury model -- so there is no existing behavior to add a deviation rule on top of. This is a
separate, materially larger feature (or two), not a follow-on to what's built here.

Verified: `checkSubstitutions`'s emergency-deviation lifecycle (trigger, hold through the hysteresis
band, resume) and the Coaching Insights message split are covered by new unit tests. The overtime
prompt was verified against a real random game reaching overtime in a live browser session (not
forced -- found by retrying the normal draft-to-watch flow until one occurred): the pause fires with
the score/clock frozen at the Q4 buzzer, the banner and both buttons render, and "Continue to
Overtime" correctly resumes into a ticking OT clock with the right score. `Skip to Final` from that
same paused state was exercised via the pending-step fix's unit coverage rather than re-triggering
another live overtime game for it specifically.

### Phase I — Unsatisfiable charts, and minutes as a real budget — **done**

Two follow-ons found by reading the finished feature back against the engine.

**A double-booked chart corrupted the sim.** Phase G's `doubleBookedConflicts` warning is advisory --
it colors text red, it doesn't block `setRotationPlan` -- so a plan naming one player in two slots at
once reached `checkSubstitutions` intact, and Phase F's per-slot "charted spans are law" branch
happily seated him in both. The result was four bodies on the floor and a duplicate `OnCourtRecord`
in every possession of that span, which `deriveBoxScore` counts once *per record*: up to 2x minutes
for that player, flowing on into `aggregateSeasonMinutes` and `dpFormula`. A double-booked young
high-potential player was a development exploit, not just a cosmetic lineup bug.

The fix resolves the chart for all five slots up front (`resolveChartedFive`) instead of slot by
slot. A claimed player wins the first slot to ask for him in `POSITION_ORDER`; the losing slot falls
through to the coach heuristic, the same fallback an Auto span and an exhausted charted player
already use, so an unsatisfiable plan degrades to ordinary coaching rather than to a broken five.
Two cases beyond the obvious one had to be handled: a chart legitimately *moving* a player between
slots vacates his old one mid-loop, so that slot is refilled whether or not the ordinary sub-out
triggers fire (with its candidate preferences relaxing in turn -- rested same-position, then any
same-position, then anyone -- since "leave the incumbent in" isn't available when the incumbent is
standing somewhere else); and Phase H's emergency deviation must *not* count as claiming a player,
or declining him at PG would wrongly deny him to SG. Five unit tests cover these; all twenty
pre-existing substitution tests pass untouched, so satisfiable charts are behavior-neutral.

**Rotation minutes are now allocated per position.** `rotationMinutes` accepted any 0-48 value per
player, so a GM could hand out minutes that didn't exist -- five 40-minute point guards was a legal
chart input. It's now a per-position budget of `REGULATION_MINUTES`, 240 across the team, held by
`run/minutesBudget.ts` and enforced in `setRotationMinutes`.

This enforces an invariant the codebase already had rather than inventing one: `randomTeam.ts`'s
`computeRotationMinutes` normalizes `ROTATION_DEPTH_WEIGHTS` to sum to `REGULATION_MINUTES` *within
each position group*, and that constant's doc comment says so outright. Nothing held GM edits to it.
So no migration and no regeneration -- a test asserts generated teams already comply. Grouping is by
`positions[0]`, which is the same grouping the heuristic substitutes within, so a group's minutes are
genuinely only spendable on that group.

Ceilings round *down*: generated targets are unrounded thirds and seventeenths of 48, and rounding up
would let a group creep past budget by a fraction. A group can also sit legitimately *under* budget --
a roster-trimming house rule (Short Bench) drops players after the generator has allocated their
share -- which is benign, since a slot is still occupied for all 48 minutes; only the targets sum low.
Both were caught in the browser rather than by the unit tests, which is worth remembering about this
layer: the fractional-ceiling bug was invisible until an `<input max>` rendered `33.88235294117647`.

Each minutes input caps at its own player's ceiling, and a `PositionMinutesSummary` above both
minutes tables reads `PG 38/48 +10 free · SG 48/48 · ...` so a capped input reads as "that time is
committed" rather than as a stuck control. Verified live through a real run: an over-cap write
clamped, freeing a backup's minutes raised the starter's ceiling by exactly that much, the edit
survived a reload, and both editing surfaces (My Team, and the checkpoint's Adjust the Rotation)
render the readout.

### Phase J — The chart feeds synergy and projected usage — **done**

Closes Phase F's deliberate deferral: `systemDraft.ts`'s `availability()` now reads the chart, so the
thing that actually decides who plays finally reaches the projection that assumes it knows.

The model splits the game the way the engine does. **Charted spans are known exactly** and count at
face value, including time at a slot that isn't the player's own -- he's on the floor either way.
**`rotationMinutes` governs the rest**, because that is precisely what the coach heuristic reads for
Auto time, prorated by how much of that slot's budget the chart hasn't already spent:

```
availability[p] = chartedMinutes[p] + rotationMinutes[p] × (unchartedMinutesAt(p's slot) / 48)
```

Chart the PG slot end to end and the backup point guard's target minutes are worth nothing, because
there is no Auto time left for him to take -- which is exactly what will happen in the game.

Two properties worth keeping. It **reduces to the old behavior identically** when there's no chart:
uncharted is the whole game, the proration factor is 1, and every player is weighted by his raw
target minutes as before. And it's **continuous** rather than a mode switch -- one 60-second segment
moves the weights by one segment's worth, so there's no discontinuity the first time a GM touches the
editor. Both matter because this function sets `Team.synergyScore`, which multiplies offense strength
in every possession of every game.

The `POSITION_MINUTES_BUDGET` denominator is Phase I's per-position budget, which is what makes the
proration meaningful: a group's `rotationMinutes` are its share of a slot's 48, so the two systems
compose rather than each having a private idea of what a full game is.

**Section 8's last open question is settled with it.** `setRotationPlan` (`RunProvider.tsx`) now
routes through `teamsWithRecomputedSynergy` exactly as `setRotationMinutes` does, because a
chart-only edit finally has something for that recompute to see. Phase 0's precedent -- recompute
immediately, on every edit -- was indeed the answer.

The three public entry points (`computeInitialSynergyScore`, `computeProjectedUsageShares`,
`computeSystemFitBreakdown`) now take a `RotationSource` (`Partial<Pick<Team, 'rotationMinutes' |
'rotationPlan'>>`) instead of a bare minutes record, so callers hand over the team itself and can't
supply one half of the rotation picture while silently dropping the other.

Verified by nine new unit tests (all-Auto plan is a genuine no-op; a fully charted slot hands its
backup nothing; proration sits strictly between those; charted time at a foreign slot still counts;
charting the post unit rates Twin Towers above charting the guards) plus `chartedMinutes`' own
coverage. In-browser against a real run: charting a post center into the PG slot moved a Motion
Offense team's synergy 76 → 75 → 74 as it went from one period to four, monotonically and in the
right direction, and the new score survived a reload.

---

## 7. Decisions settled

1. **Pace** — double total possessions to ~200. §2.
2. **Free-form fives** with a scaling out-of-position penalty from slide distance, height fit and
   role fit, plus derived Positionless / Specialist quirks. §4.
3. **Authoritative chart with Auto segments.** Charted spans are law; unfilled or explicitly-Auto
   spans fall through to the coach heuristic.
4. **AI teams get no charts** — they keep the existing fatigue/pace heuristic.
5. **Overtime** — normal sim carries the Q4 closing five. Simcast prompts for substitutions at the
   start of each overtime period.

## 8. Open questions

- **Penalty magnitude is now a real, tunable first cut, not settled.** `POSITION_FIT_SLIDE_PENALTY_PER_SLOT`
  (6) and `POSITION_FIT_HEIGHT_PENALTY_PER_INCH` (3) in `constants.ts` are estimates: a max four-slot
  slide docks the hardest-leaned-on attributes 24 points before the height term. A GM can build a
  real out-of-position lineup now (Phase G), so the thing that was blocking this tuning is gone --
  but nothing has actually been tuned against one yet. Watch the synergy knock-on
  (`computeInitialSynergyScore` reads the same attributes through `possessionRoles.ts`) as well as
  the per-possession effect, as originally planned.
- **Quirk derivation thresholds are now real, tunable numbers, not settled.**
  `POSITIONLESS_MIN_HEIGHT_BANDS` / `POSITIONLESS_ATTRIBUTE_SPREAD_MAX` / `SPECIALIST_ATTRIBUTE_SPREAD_MIN`
  / `SPECIALIST_HEIGHT_EDGE_INCHES` in `constants.ts`. One consequence worth knowing before tuning
  further: because PG's and C's own height bands are narrow and mostly consumed by their one neighbor's
  overlap, almost every single-band PG/C height is close enough to that band's outer edge to read as
  Specialist by height alone -- SG/SF/PF, each with two neighbors, have more room to be genuinely
  neutral. Not obviously wrong (a "pure", non-overlapping point guard height *is* a shorter point
  guard), but it means Positionless/Specialist are not evenly distributed across positions today.
- **Attribute-fit "role fit" is not separately modeled.** §4 flagged `PLAY_CALL_MODELS` as a better
  basis than `POSITION_BIAS` for the penalty's attribute-fit component; Phase E's demand-weighting
  instead derives directly from the engine's interior/perimeter split (see Phase E above) because
  `PLAY_CALL_MODELS` has no slot dimension to map demand onto without inventing one. The claimed
  payoff still holds regardless -- because `selectPlayers`/`possessionRoles`/synergy all read
  `player.attributes` and now see the docked copy, an out-of-position player automatically contributes
  less and draws fewer projected touches, with zero bespoke wiring for that part. Revisit if the
  interior/perimeter split proves too coarse once real charts expose it.
- **Secondary positions.** Resolved for now: `Player.positions` stays single-valued and affinity is
  fully derived from height + attribute profile (no generation change), per the option §4 left open.
  Revisit only if a real secondary-position mechanic (not just fit-penalty math) becomes worth adding.
- **Does the GM see the penalty numerically, or as a badge? Resolved as qualitative for now:** a bare
  red `!` on the mismatched segment, no severity number -- readable at the 30px cell size the grid
  actually has room for. The numeric side isn't gone, just relocated: the summary panel's fatigue and
  charted-minutes columns are exact numbers, just not the attribute-dock severity itself. Revisit if a
  GM wants to know *how bad* before committing, not just *that* it's bad.
- **Does the chart feed synergy continuously, or only at stretch boundaries? Resolved (Phase J):
  continuously.** `setRotationPlan` recomputes on every edit, the same as `setRotationMinutes`,
  now that `availability()` reads the chart and a chart-only edit has something for the recompute to
  see. Phase 0's precedent held.
