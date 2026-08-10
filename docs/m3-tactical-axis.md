# M3 — Tactical Axis

Planning doc for the M3 milestone. Companion to `HotSeatFeatureTiers.md`, which owns the catalog and
the milestone table; this owns the order, the decisions, and the measurements behind them.

**What M3 is for.** Everything shipped so far varies *the team you are handed* and *how you build it*.
M3 adds the second strategic axis: how you play a given game. That is what makes two runs with the
same roster play differently, which is the thing a roguelite is actually selling.

M3's contents per the tiers doc: in-game decisions levels 1-2 (Tier 13), opponent scouting (Tier 17),
tactical focus points (Tier 19), position-fit tuning (Tier 7.6), more team-construction options
(Tier 3).

---

## Three findings that change the shape of this milestone

### 1. Tier 13 level 2 is half shipped, and Tier 19 is the other half

Tier 13's level 2 is defined as "changes affecting only future possessions -- defensive scheme, focus
points, play-call emphasis." Two things follow that the milestone table doesn't show:

- **The mechanism already exists.** `simulateGameSteps` accepts a `CoachingDirective` through
  `next()`, applied from the following possession, and mid-broadcast defensive scheme switching ships
  today. The architectural risk this tier was written around is gone, not deferred.
- **Tier 19 *is* the rest of level 2.** Focus points and play-call emphasis are the same sentence in
  Tier 13's own definition. Listing Tiers 13 and 19 as separate M3 line items double-counts one piece
  of work.

Today the directive is exactly:

```ts
export interface CoachingDirective {
  teamId: TeamId
  defensiveSchemeId: string
}
```

So the remaining level-2 work is **widening that type and its `applyDirective`**, plus the settings
and UI that produce one. That is meaningfully less than the milestone table implies.

### 2. Position-fit "quirks" are the default case, not quirks

The tiers doc flags a suspected skew: "PG and C height bands are narrow and mostly consumed by their
single neighbor's overlap, so almost any pure PG or C reads as Specialist by height alone." Measured
over 30 generated leagues (~2,900 players):

| Position | Positionless | **Specialist** | Neutral |
|---|---|---|---|
| PG | 4.7% | **76.0%** | 19.3% |
| SG | 28.6% | **53.2%** | 18.2% |
| SF | 41.0% | 33.1% | 25.9% |
| PF | 28.6% | **54.8%** | 16.6% |
| C | 1.7% | **58.2%** | 40.0% |

Three in four point guards are Specialists. A label meant to mark a player *built for exactly one
slot* applies to the majority of the league, which means it carries no information — and because
Specialist multiplies the out-of-position penalty by 1.5, **the harsh case is the common case**. The
neutral player the penalty constants were reasoned around is the rarest of the three at every
position except center.

The cause was arithmetic, not judgment, and there were two of them.

**The attribute test was reading the position back to itself.** `SPECIALIST_ATTRIBUTE_SPREAD_MIN` ran
against a raw max-minus-min, but `POSITION_BIAS` builds spread in by construction — a PG is rolled at
+15 ballHandling and −15 rebounding, a 30-point gap before a die is thrown. So the test largely asked
*"is this point guard shaped like a point guard."* The table above is the proof: SF is the only
position with an empty bias entry and the only one that came out mostly neutral.

**The height test could never be rare.** `SPECIALIST_HEIGHT_EDGE_INCHES` was 1 against a PG band only
five inches wide, so four of five possible heights sat "at an edge" — but even at 0, a quarter of
every position lands exactly on a band edge, because the bands are five to seven discrete inches
wide. No value of the constant makes that arm uncommon.

### Shipped ✅

`positionRelativeSpread` subtracts `POSITION_BIAS` before measuring, which collapses the between-
position gap: median residual spread is 32-34 at *every* position, against a raw median that ran from
34 (SF) to 48.5 (C). One threshold now means the same thing everywhere. Thresholds re-derived from
that distribution: `POSITIONLESS_ATTRIBUTE_SPREAD_MAX` 35 → **26**, `SPECIALIST_ATTRIBUTE_SPREAD_MIN`
55 → **42**.

The height arm of `isSpecialist` was **removed rather than retuned**, which the plan did not
anticipate. It double-counted: `effectivePlayer` already charges an extreme height per inch through
`heightMisfitInches`, continuously and in the right direction (the shortest PG is the one who misfits
every slot he slides to). Worse, flagging him Specialist multiplied the *slide-distance* term by 1.5
too, which has nothing to do with his height — and it did so as a cliff, one inch flipping a player
between 1x and 1.5x. `SPECIALIST_HEIGHT_EDGE_INCHES` is deleted. Height inflexibility is still
priced; it is priced once, smoothly, where it belongs.

| Position | Positionless | Neutral | Specialist |
|---|---|---|---|
| PG | 18.7% | **64.4%** | 16.9% |
| SG | 20.1% | **59.9%** | 20.0% |
| SF | 14.6% | **67.3%** | 18.1% |
| PF | 21.9% | **60.5%** | 17.5% |
| C | 9.4% | **66.0%** | 24.6% |

Neutral is the plurality everywhere at 60-67%, and both labels sit in the 15-25% target band. The one
outlier is C's 9.4% Positionless, which is structural and correct: a center's height lands in a
second position's band only 37.6% of the time, so centers really are the least positionally flexible
players in the league. `positionFit.test.ts` now asserts this distribution rather than anyone
eyeballing it once.

Slide cost, same sample, in points of raw overall quality — down 10-15% purely from removing 1.5x
surcharges that should never have applied:

| Slide | Before | After |
|---|---|---|
| 1 slot | 4.96 | 4.43 |
| 2 slots | 12.79 | 11.52 |
| 3 slots | 22.29 | 18.78 |
| 4 slots | 27.71 | 24.33 |

`POSITION_FIT_SLIDE_PENALTY_PER_SLOT` and `POSITION_FIT_HEIGHT_PENALTY_PER_INCH` were deliberately
**not** touched — changing labels and magnitudes in the same pass means being unable to attribute
either effect. Whether the numbers above are the right size is an M2 playtest question.

A one-slot slide costing ~5 points is mild; a four-slot slide costing ~28 turns a 70 into a 42. Both
are defensible in isolation. Neither has been checked against whether a GM ever *wants* to slide
someone, which is the actual question and needs the chart in front of a player to answer.

### 3. Scouting and focus points are an ordered pair, for feel rather than for code

Neither blocks the other technically. But focus points without scouting are a dial with nothing to
aim at, and scouting without focus points reveals information you can only act on with the defensive
scheme you can already change. Built in that order, the second lands as an answer to a question the
first just raised.

---

## Decisions — settled

All four are decided. Reasoning kept so they can be revisited on evidence rather than re-argued from
scratch.

### D1. The directive type — build it for M6 now ✅

**Decided: widen it now to carry everything levels 1-4 will need, rather than reworking at M6.**

Levels 1-2 need only a narrow directive, but every place that sends one would have to change when
substitutions and timeouts arrive, and M6 is already the milestone most likely to slip. The extra
cost now is roughly half a day.

The current single-purpose shape does not extend. A discriminated union does, and keeps the engine's
`applyDirective` exhaustive so a new kind cannot be silently ignored:

```ts
export type CoachingDirective =
  | { kind: 'defensive-scheme'; teamId: TeamId; schemeId: string }
  | { kind: 'tactical-focus'; teamId: TeamId; focus: TacticalFocus }
  // M6 slots in here without touching any existing sender:
  // | { kind: 'substitution'; teamId: TeamId; slot: Position; playerId: PlayerId }
  // | { kind: 'timeout'; teamId: TeamId }
```

**Directives are absolute, not relative** — they set a value rather than nudging one. The playback
hook deliberately keeps only the *latest* queued directive, so a relative nudge would be silently
dropped whenever two arrived between possessions. Absolute is also idempotent, which makes replay
and testing straightforward.

### D2. Focus points are standing settings, and offense gets its own layer ✅

**Decided: focus points behave exactly like the defensive scheme — a standing value, changeable from
a checkpoint, from My Team, or mid-broadcast, with every path writing the same field.** No per-game
prompt, no bulk-sim special case.

Making them behave the same way required naming a gap first, and this is the substantive part of the
decision: **offensive focus has to be its own layer, separate from the drafted system.**

The two ends of the floor are not currently symmetric, and layering focus on top would have made that
worse rather than better:

| | Named preset | Changeable? | Scored by synergy |
|---|---|---|---|
| Offense | System (Motion, Twin Towers…) | **No — drafted once, fixed for the run** | Yes |
| Defense | Scheme (Man-to-Man, Zone…) | Yes, any time | No |

If offensive focus were "a modifier on the drafted system", it would be a changeable thing wearing
the same name as a fixed thing, and every question about it ("did I change my offense?") would have
two answers. Separating it gives a clean four-part model where each end of the floor has one fixed-ish
identity and one live dial:

- **Offensive system** — drafted, fixed for the run, the identity synergy is scored against.
- **Offensive focus** — pace and shot selection. Standing, changeable any time.
- **Defensive scheme** — chosen, changeable any time.
- **Defensive focus** — interior/perimeter emphasis and rebounding vs. transition. Standing,
  changeable any time.

**Both focuses now behave identically to each other and to the defensive scheme**, which is what the
decision asked for. One remaining asymmetry is deliberate and stays: the offensive *system* is fixed
where the defensive *scheme* is not. That is Tier 4's drafted variation doing its job — the system is
the run's identity and carries a synergy score; making it freely swappable would flatten the draft
into a menu. Recorded here so it reads as a choice rather than an oversight.

> **Consequence: focus feeds synergy, and that is the point.** Synergy scores how well the roster fits
> the play-call mix it will actually run, and it already recomputes whenever the inputs move — camps,
> minutes, the rotation chart. Offensive focus changes that mix, so it belongs in the same recompute
> (`teamsWithRecomputedSynergy` already exists and routes every other input through it).
>
> This is also the best available answer to the risk logged at the bottom of this doc. A dial whose
> effect is flat is a dial everyone eventually sets the same way; a dial that moves synergy is
> **roster-dependent** — hunting threes suits a Pace-and-Space roster and actively hurts Twin Towers,
> so the right answer differs per run rather than being solved once. That is the difference between a
> setting and a decision.

### D3. Scouting reveals system, scheme and starting five ✅

**Decided: not the full attribute sheet.**

Full visibility turns every game into homework and sits badly against synergy being a hidden property
of your own roster. This is enough to make a real plan against an opponent — which is the whole point
of pairing scouting with focus points — without making optimal play a spreadsheet exercise.

**Opponent player pages stay reachable** (`PlayerScreen` already renders any player) **but hide the
attribute table for players not on your team**, showing identity, tags and role instead. Otherwise
the link quietly reinstates exactly the full-sheet visibility this decision rules out.

**Shipped, and it needed one more gate than that.** The tags themselves are public but their
tooltips were not -- `playerTags` quotes the rating behind each one, and those ratings are hidden
even on your own attribute sheet. See item 2 below.

Deeper scouting as a shop purchase stays available as a later addition, and would give Budget another
claimant — but it is not part of M3, and adding a shop card before scouting has proved fun is the
wrong order.

### D4. Retune the position-fit thresholds ✅

**Decided: adjust the numbers so the labels become rare again, keeping the three-bucket model.**

Cheapest fix, keeps a model that is otherwise working, and the result can be measured exactly the way
the problem was.

**Target: neutral is the plurality at every position, with each label somewhere near 15-25%.** The
exact split matters less than neutral being the default, which is what makes a quirk mean something.

**Shipped, and the target was met** — see finding 2 above for the numbers. The measurement changed
the shape of the fix twice: the attribute threshold had to be re-derived against a *position-relative*
spread rather than merely raised, and the height arm had to be removed rather than tuned, because no
value of `SPECIALIST_HEIGHT_EDGE_INCHES` makes a quarter of the league uncommon.

**The escalation is no longer needed for the reason it was written.** A `positionalFlexibility`
spectrum was held in reserve against the cliff where one inch of height flips a player between 0.5x
and 1.5x. Removing the height arm removes that cliff on the Specialist side outright. Positionless
still has a discrete height gate (`heightBandsContaining(...).length >= 2`), so a one-inch cliff
between 0.5x and 1x survives there — smaller, one-sided, and worth revisiting only if playtesting
says it reads as arbitrary.

---

## Build order within M3

Sequenced so each piece lands with a reason to exist, and so the two measurement-driven items are
separated by the two feature items (tuning back to back is hard to judge).

| # | Item | Tier | Days | Why here |
|---|---|---|---|---|
| 1 | Position-fit retune ✅ | 7.6 | 2–3 | Independent, measurement-driven, and currently mis-scaled in a way that will distort any judgment about out-of-position play made after it |
| 2 | Opponent scouting ✅ | 17 | 3–4 | Gives the next item something to aim at |
| 3 | Tactical focus points + directive widening | 19 + 13 L2 | 6–8 | The milestone's centerpiece; the answer to what scouting reveals |
| 4 | Team-construction options | 3 | 2–3 | Independent and small; good closing item while focus points settle |
| 5 | Generalized pause-on-condition | 13 L1 | 1–2 | Only worth doing if focus points want a mid-game prompt — decide after 3 |

**Total 14–20 days**, matching the milestone table. Item 3 held at 6–8 through D2 being re-decided:
dropping the per-game editor and the bulk-sim special case gave back about a day, and separating
offensive focus from the drafted system — including routing it through the synergy recompute and
making the playbook re-readable mid-game — took it straight back.

### 1. Position-fit retune (2-3 days) ✅ shipped

Not a feature — a measurement, a constant change, and a re-measurement. Finding 2 above carries the
before/after tables; what actually shipped:

- `POSITION_BIAS` moved from `engine/generator/randomPlayer.ts` into `engine/constants.ts`, so the
  generator and `positionFit` read one table rather than two that can drift. Same precedent as
  `POSITION_HEIGHT_RANGE_INCHES`, which already had a second reader for the same reason.
- `positionRelativeSpread` added beside `attributeSpread`: subtract the position's own bias, *then*
  take max-minus-min. Both quirks read it. `attributeSpread` stays exported — it is independently
  tested and is the honest name for the raw measure.
- `POSITIONLESS_ATTRIBUTE_SPREAD_MAX` 35 → 26, `SPECIALIST_ATTRIBUTE_SPREAD_MIN` 55 → 42, both
  derived from the residual distribution rather than adjusted by feel.
- `SPECIALIST_HEIGHT_EDGE_INCHES` deleted along with the height arm of `isSpecialist`.
- The distribution is now a regression test in `positionFit.test.ts` (five seeded leagues, ~480
  players), asserting neutral is the plurality everywhere and neither label is dead or dominant. It
  doubles as the measurement tool if generation changes.
- Slide cost re-measured and recorded; no penalty magnitude touched.

**The synergy knock-on turned out to be a non-issue.** `effectivePlayer` returns the same reference
when the slot matches the player's own position, and every AI team and every un-charted user team is
in that case — so the reveal screen's synergy and projected-usage numbers only move for a team the GM
has deliberately charted out of position. The full scoring-calibration suite passing unchanged is the
evidence.

### 2. Opponent scouting (3-4 days) ✅ shipped

- `ui/screens/TeamScoutScreen.tsx`: offensive system, defensive scheme, starting five, standings
  position, the season series against you (`headToHeadRecord`, new in `engine/schedule/standings.ts`),
  group averages through the same `TeamSummary` My Team uses, and a roster of position / age / height
  / tags.
- Entry points as planned -- the standings row and the schedule row's abbreviation -- both through
  `ui/components/TeamName.tsx`, the sibling of `PlayerName`. `playerInspector.core.ts` became
  `inspector.core.ts` and its context now carries `openTeam` alongside `openPlayer`, rather than a
  second near-identical context file: every provider site offers both destinations and they behave
  identically. The scouting report sits directly *under* the player page in `App.tsx`'s routing, so
  opening one of an opponent's players and coming back lands on the report rather than dropping out
  to the run.
- **D3 took more enforcing than "hide the attribute table".** Two leaks the plan did not name:
  - `PlayerScreen` renders any player and the report links to all of them, so it needed an opponent
    mode -- attribute table, potential, overall rating and the hidden consistency/clutch/durability
    block are all gated to your own roster now.
  - **The tag tooltips were a bigger leak than the attribute sheet.** `playerTags`' `detail` quotes
    the rating behind each tag ("Clutch 82", "110 attribute points of room") -- numbers hidden even
    on your own sheet. `scoutingTags` strips them.
- **One thing the plan got wrong, found by opening the screen.** With every tag shown, the Scouting
  Notes column was dominated by Rising / Declining / Untapped / Maxed Out, which fire on nearly every
  player and say nothing about how to play them tonight. `scoutingTags` drops all four: the first two
  are a pure function of age (`computeAgeCurveStage`) and the report has an Age column, and the last
  two read `development.potential`, which is both the most private thing on the page and the least
  tactically useful. The rule that fell out is worth keeping for item 3: **a scouting tag is
  something you could learn by watching them play.**

### 3. Tactical focus points + directive widening (5-7 days)

The centerpiece. Four dials, each modifying something the engine already reads:

| Focus | Modifies | Where |
|---|---|---|
| Pace: control vs. push | the pace scale sampled per possession | `possessionDurationSeconds` |
| Shot selection: rim / balanced / threes | playbook weights before selection | `selectPlayCall` |
| Interior vs. perimeter defense | the scheme's `interiorFocus` | `resistance.ts`'s `applyInteriorFocus` |
| Crash the boards vs. leak out | offensive rebound rate, and transition frequency | `offensiveReboundProbability`, playbook weights |

**Each is an offset on an existing knob, not a new model.** That is what keeps this tractable: a focus
point is a modifier applied to the playbook or scheme *before* the existing code reads it, so no
resolution logic changes.

Work breakdown:
- Widen `CoachingDirective` to the union in D1, and make `applyDirective` exhaustive over it.
- Add `Team.offensiveFocus` and `Team.defensiveFocus` (both optional, so existing saves stay valid),
  and `setOffensiveFocus` / `setDefensiveFocus` actions mirroring `setDefensiveScheme` exactly.
- Apply the offsets at the four sites above, each behind a named constant so they can be tuned.
- **Route offensive focus through `teamsWithRecomputedSynergy`**, alongside the minutes and chart
  edits that already recompute. `computeInitialSynergyScore` and `computeSystemFitBreakdown` take the
  playbook, so the change is to hand them a focus-adjusted playbook rather than the raw preset — one
  helper, applied everywhere a playbook is read, including the reveal screen's fit breakdown.
- UI: focus controls sit **wherever the defensive scheme already sits** — My Team, the checkpoint,
  and the simcast — because that is what "behave the same way" means. Group them by end of the floor
  (Offense: system, focus / Defense: scheme, focus) so the fixed item and the live one read as a pair.
- No per-game editor and no bulk-sim special case. Every path reads the stored value, which is the
  simplification this decision bought.

**One trap to avoid.** `simulateGameSteps` reads `homeTeam.offensiveStrategyId` and resolves the
playbook once per game (line ~127), and reads `synergyScore` once with a comment saying it cannot
change mid-game. Offensive focus *can* change mid-game via a directive, so the playbook has to become
re-readable the same way `homeScheme` already did when defensive switching landed. Synergy is the
harder half: the stored score is computed outside the sim, so a mid-game focus change would leave the
multiplier stale for the rest of the game. **Decide when building:** either recompute the multiplier
inside the directive handler, or accept that a mid-game focus change moves play-calls immediately and
synergy only from the next game. The second is simpler and arguably more honest — synergy is a
season-scale fit measure, not a possession-scale one — but it needs saying on screen or it reads as a
bug.
- **Every dial needs a real cost.** Push the pace and you take worse shots; crash the boards and you
  concede transition. A dial with only an upside is a strictly-correct setting, which is the failure
  mode to design against here.

### 4. More team-construction options (2-3 days)

Two new roster quirks, following the established four-axis discipline (see Tier 3):
- *One Random Superstar* — elevates a randomly chosen player, not the roster's best. Decide whether
  the position is re-rolled too.
- *Underdog Squad* — low current attributes, high potential across the whole roster.

### 5. Generalized pause-on-condition (1-2 days, conditional)

Tier 7.5's overtime prompt is a pause-and-acknowledge that already works. Generalizing it is only
worth doing if focus points want a mid-game prompt ("you are down 15 at half — change anything?").
Decide after item 3, when it is clear whether the simcast controls are enough on their own.

---

## What M3 does not include, and why

- **Substitutions and matchups mid-game** (Tier 13 levels 3-4) stay at M6. They mutate `RotationState`
  rather than feeding an input, which is a different problem from everything above.
- **Playoffs and season structure** (Tier 12) stay at M4. M3 changes how a game is played; M4 changes
  what a season is for. Doing them together would mean tuning difficulty against two moving targets.
- **A custom playbook editor.** Focus points are deliberately a small set of dials rather than a
  weight editor: the point is a decision made in seconds between games, not a spreadsheet.

## Open risk

**Focus points are the first system that lets a GM tune the simulation against itself.** If any dial
is strictly better than its opposite, it stops being a decision and becomes a setting everyone picks
once. The costs listed in item 3 are the mitigation, but they are reasoned rather than measured, and
the honest test is M2's playtesters reaching for the same dial every game. Worth instrumenting: log
which focus a run ends on, and check whether it varies.
