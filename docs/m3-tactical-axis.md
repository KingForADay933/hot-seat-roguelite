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

The cause is arithmetic, not judgment: `SPECIALIST_HEIGHT_EDGE_INCHES` is 1, and PG's height band is
only five inches wide (72-76), so four of five possible heights sit "at an edge." SF is the only
position with enough band width and enough neighbor overlap to come out mostly neutral — which is
exactly why it is the one position that reads as Positionless more often than Specialist.

Slide cost, same sample, in points of raw overall quality:

| Slide | Average cost |
|---|---|
| 1 slot | 4.96 |
| 2 slots | 12.79 |
| 3 slots | 22.29 |
| 4 slots | 27.71 |

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

Deeper scouting as a shop purchase stays available as a later addition, and would give Budget another
claimant — but it is not part of M3, and adding a shop card before scouting has proved fun is the
wrong order.

### D4. Retune the position-fit thresholds ✅

**Decided: adjust the numbers so the labels become rare again, keeping the three-bucket model.**

Cheapest fix, keeps a model that is otherwise working, and the result can be measured exactly the way
the problem was. Candidate levers, in order of bluntness: drop `SPECIALIST_HEIGHT_EDGE_INCHES` from 1
to 0, raise `SPECIALIST_ATTRIBUTE_SPREAD_MIN` above 55, widen `POSITION_HEIGHT_RANGE_INCHES` for PG
and C.

**Target: neutral is the plurality at every position, with each label somewhere near 15-25%.** The
exact split matters less than neutral being the default, which is what makes a quirk mean something.

**If it still reads as arbitrary after retuning, the escalation is the spectrum** — one
`positionalFlexibility` score driving a continuous severity multiplier, removing the cliff where one
inch of height flips a player between a 0.5x and a 1.5x penalty. Deliberately not done first: it is a
bigger change, it touches the reveal screen and synergy, and the buckets may well be fine once they
are actually rare.

---

## Build order within M3

Sequenced so each piece lands with a reason to exist, and so the two measurement-driven items are
separated by the two feature items (tuning back to back is hard to judge).

| # | Item | Tier | Days | Why here |
|---|---|---|---|---|
| 1 | Position-fit retune | 7.6 | 2–3 | Independent, measurement-driven, and currently mis-scaled in a way that will distort any judgment about out-of-position play made after it |
| 2 | Opponent scouting | 17 | 3–4 | Gives the next item something to aim at |
| 3 | Tactical focus points + directive widening | 19 + 13 L2 | 6–8 | The milestone's centerpiece; the answer to what scouting reveals |
| 4 | Team-construction options | 3 | 2–3 | Independent and small; good closing item while focus points settle |
| 5 | Generalized pause-on-condition | 13 L1 | 1–2 | Only worth doing if focus points want a mid-game prompt — decide after 3 |

**Total 14–20 days**, matching the milestone table. Item 3 held at 6–8 through D2 being re-decided:
dropping the per-game editor and the bulk-sim special case gave back about a day, and separating
offensive focus from the drafted system — including routing it through the synergy recompute and
making the playbook re-readable mid-game — took it straight back.

### 1. Position-fit retune (2-3 days)

Not a feature — a measurement, a constant change, and a re-measurement.

- Reuse the diagnostic shape this doc's tables came from: quirk distribution by position, and average
  quality lost per slide distance.
- Target: Specialist and Positionless each land somewhere near 15-25% per position, with neutral the
  plurality everywhere. The exact numbers matter less than *neutral being the default*, which is what
  makes a quirk mean something.
- Re-measure slide cost afterwards. The severity multipliers act on it, so changing which players are
  labelled changes the effective penalty even if no penalty constant moves.
- **Watch the synergy knock-on.** `effectivePlayer` feeds attribute reads, and synergy and projected
  usage read the same attributes, so this moves numbers on the reveal screen as well as in the sim.

### 2. Opponent scouting (3-4 days)

- A read-only opponent view: roster with tags, starting five, offensive system, defensive scheme.
- Entry points: the schedule row (the opponent you are about to play) and the standings table (anyone).
- `bundle.teams` and `bundle.players` already hold every team's full state; `TeamSummary` already
  renders group averages for an arbitrary team; `PlayerScreen` already renders any player. This is
  mostly assembly and an entry point.
- Per D3, hide the attribute table for players not on your team.

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
