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

### D2. Focus points are picked per game, and changeable live ✅

**Decided: a per-game choice, editable on the fly during a simcast.** Not a standing setting the way
the defensive scheme is — a tactical plan aimed at the specific opponent in front of you.

This is the most interesting answer of the four and the one that costs the most, because it collides
with something the game already does: **games can be played in bulk.** "Sim Next Stretch" and "Sim
the Rest & Continue" resolve eight games with no per-game interaction, and blocking each on a tactics
prompt would either gut those buttons or throw away the feature for anyone who uses them.

So the shape is per-game *choice* over a sticky *value*:

- `Team.tacticalFocus` stores the current plan. Optional, so existing saves stay valid.
- **On the stretch screen**, each of the GM's own upcoming games carries its tactics inline —
  pre-filled from the stored value, editable in place before hitting Sim or Watch Live. Inline rather
  than a blocking pre-game screen, so simming a game does not grow a modal.
- **Editing writes back**, so the next game defaults to what you last chose rather than resetting to
  nothing. "Per game" means *asked every game*, not *forgotten every game* — nobody wants to rebuild
  a plan from scratch 32 times a season.
- **Mid-simcast changes** go through the directive and write back too, exactly as the defensive
  scheme control already does.
- **Bulk sim uses the stored value** without prompting. That is the only coherent answer: the
  alternative is eight modals or a silently ignored feature.

> **Consequence worth naming:** this leaves the defensive scheme (standing) and focus points
> (per-game) with different lifetimes, which is the thing the standing-setting option was meant to
> avoid. It is defensible — a scheme is who you are, a game plan is who you are *today* — but the UI
> has to make the difference obvious, or it will read as inconsistent rather than intentional. Two
> panels labelled by lifetime, not one merged "tactics" panel.

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

**Total 14–20 days**, matching the milestone table. Item 3 grew by a day over the first estimate once
D2 settled as per-game rather than standing: an inline per-game editor on the stretch screen is more
surface than a single settings control, and bulk sim has to be handled explicitly rather than
inheriting one value.

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
- UI, per D2: an **inline per-game editor on the stretch screen** (pre-filled from the last plan,
  editable before Sim or Watch Live), a compact version in the simcast beside the existing
  defensive-scheme control, and nothing on My Team — the scheme lives there because it is standing,
  and putting a per-game plan next to it is what would make the two lifetimes confusing.
- Bulk sim paths (`Sim Next Stretch`, `Sim the Rest & Continue`, `Sim First Stretch`) read the stored
  plan without prompting. Worth an explicit test: the failure mode is a feature that silently does
  nothing for anyone who plays that way.
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
