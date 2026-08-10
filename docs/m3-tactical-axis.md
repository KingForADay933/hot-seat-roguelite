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

## Decisions to make before writing code

Four, and the first two constrain later milestones rather than just this one.

### D1. The directive type — decide once, for M6 as well

The tiers doc already flags this: levels 1-2 need only a narrow directive, but the shape should be
designed with levels 3-4 (substitutions, matchups, timeouts) in mind, because retrofitting it later
is a rewrite of every call site.

The current single-purpose shape does not extend. A discriminated union does, and keeps the engine's
`applyDirective` exhaustive so a new kind cannot be silently ignored:

```ts
export type CoachingDirective =
  | { kind: 'defensive-scheme'; teamId: TeamId; schemeId: string }
  | { kind: 'tactical-focus'; teamId: TeamId; focus: Partial<TacticalFocus> }
  // M6: | { kind: 'substitution'; ... } | { kind: 'timeout'; ... }
```

**Decide:** whether directives are absolute (set focus to X) or relative (nudge focus one step).
Absolute is simpler to reason about and idempotent, which matters because the playback hook keeps
only the latest queued directive. Recommend absolute.

### D2. Are focus points a standing setting or a per-game tactic?

Defensive scheme resolved this already: it is a persisted standing instruction, changeable from a
checkpoint, from My Team, or mid-broadcast, and every path writes the same value. Focus points should
follow it exactly, for the same reason — two mechanisms that mean "how we play" with different
lifetimes would be a coin toss to the GM every time.

That means a `Team.tacticalFocus` field, an optional one so existing saves stay valid, and reuse of
the `setDefensiveScheme` pattern in `RunProvider`.

### D3. How much does scouting reveal?

The tiers doc's recommendation stands and is cheap: **system, scheme and starting five, not the full
attribute sheet.** Full visibility turns every game into homework and sits badly against synergy
being a hidden property of your own roster. Deeper scouting is a natural thing for the shop to sell
later, which also gives Budget another claimant.

**Decide:** whether opponent *player* pages are reachable from a scouting view. `PlayerScreen` already
renders any player, so this is a link, not a feature — but it is also the whole attribute sheet, which
contradicts the paragraph above. Recommend: link to opponents' players but hide the attribute table
for players not on your team, showing tags and role only.

### D4. What should Specialist and Positionless mean?

Two ways to fix the skew, and they are not the same decision:

- **Retune the thresholds** so the labels are rare again — raise `SPECIALIST_ATTRIBUTE_SPREAD_MIN`,
  drop `SPECIALIST_HEIGHT_EDGE_INCHES` to 0, or widen the height bands. Cheapest, and keeps the
  current model.
- **Redefine them as a spectrum** rather than three buckets — a single `positionalFlexibility` score
  driving a continuous severity multiplier. Removes the cliff where one inch of height flips a player
  between a 0.5x and a 1.5x penalty, which is the part most likely to read as arbitrary.

Recommend retuning first and measuring again, because the spectrum is a bigger change and the
buckets may be fine once they are actually rare.

---

## Build order within M3

Sequenced so each piece lands with a reason to exist, and so the two measurement-driven items are
separated by the two feature items (tuning back to back is hard to judge).

| # | Item | Tier | Days | Why here |
|---|---|---|---|---|
| 1 | Position-fit retune | 7.6 | 2–3 | Independent, measurement-driven, and currently mis-scaled in a way that will distort any judgment about out-of-position play made after it |
| 2 | Opponent scouting | 17 | 3–4 | Gives the next item something to aim at |
| 3 | Tactical focus points + directive widening | 19 + 13 L2 | 5–7 | The milestone's centerpiece; the answer to what scouting reveals |
| 4 | Team-construction options | 3 | 2–3 | Independent and small; good closing item while focus points settle |
| 5 | Generalized pause-on-condition | 13 L1 | 1–2 | Only worth doing if focus points want a mid-game prompt — decide after 3 |

**Total 13–19 days**, against the milestone table's 14–20. The overlap found above roughly cancels the
work added by taking position-fit tuning seriously, so the headline number stands.

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
- Add `Team.tacticalFocus` (optional), and a `setTacticalFocus` action mirroring `setDefensiveScheme`.
- Apply the offsets at the four sites above, each behind a named constant so they can be tuned.
- UI: a focus panel on My Team and the checkpoint, and a compact version in the simcast beside the
  existing defensive-scheme control.
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
