# Rotation Charts — groundwork

Planning notes for a 2K-style rotation chart: a per-quarter timeline where the GM maps out exactly
who is on the floor, when, and for how long. This document records what the engine does today, what
has to change, in what order, and the decisions already settled.

Written against master as of the simcast (#8) and team-reveal/system-fit (#9) merges. Phases 0
through E are now done (see Section 6) -- Sections 1-2 below describe the possession-counted engine
those phases replaced, and are kept as the historical record of why the clock and pace changes were
needed, not as a description of the engine as it stands today.

---

## 0. Fix first: synergy goes stale when minutes change

Not part of the rotation chart, but it has to be fixed before one is built, because a chart is a far
bigger minutes change than nudging a single slider.

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
  remains a synergy input (§0), so a chart must feed the same recompute.
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

### Phase 0 — Recompute synergy on rotation change
§0. Small, independent, and a live bug today.

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
because there is no way yet to construct a real chart to approximate *instead of* -- every plan in
existence right now is a synthetic test fixture. Worth revisiting once Phase G's editor exists and a
GM can actually produce one.

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
  overlapping pair and the summary panel surfaces it in red -- this is what keeps `checkSubstitutions`
  safe in trusting the plan it's handed (Phase F never validates this itself).
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

### Phase H — Deviation and edge rules
Overtime (Decision 5), exhausted charted players, later foul trouble and injuries. Deviations surface
through Coaching Insights, which already exists as that channel.

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
  slide docks the hardest-leaned-on attributes 24 points before the height term. Nothing has exercised
  these against a real chart yet (Phase F/G don't exist), so they still need tuning once a GM can
  actually build a lineup -- watch the synergy knock-on (`computeInitialSynergyScore` reads the same
  attributes through `possessionRoles.ts`) as well as the per-possession effect, as originally planned.
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
- **Does the chart feed synergy continuously, or only at stretch boundaries? Still open, and now
  concretely deferred rather than abstractly open:** `setRotationPlan` (`RunProvider.tsx`) does not
  call `teamsWithRecomputedSynergy` at all, because `computeInitialSynergyScore` still only reads
  `rotationMinutes` (Phase F's deliberate deferral of `availability()`) -- a chart-only edit has
  nothing new for that recompute to see yet. Once `availability()` is taught to read a real chart,
  this question becomes live again, and Phase 0's precedent (recompute immediately, on every edit)
  is the likely answer.
