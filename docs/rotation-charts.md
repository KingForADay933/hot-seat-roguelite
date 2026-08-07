# Rotation Charts — groundwork

Planning notes for a 2K-style rotation chart: a per-quarter timeline where the GM maps out exactly
who is on the floor, when, and for how long. Nothing here is built yet. This document records what
the engine does today, what has to change, in what order, and the decisions already settled.

---

## 1. What the clock is today

**There isn't one.** There are also no quarters.

`simulateGameSteps` (`src/engine/simulateGame.ts`) runs regulation as a *single* period of
`possessionsPerGame` possessions:

```ts
yield* runPeriod(possessionsPerGame, rollJumpBall(rng))
```

Everything time-shaped is derived after the fact from a possession index:

| Concept | How it's produced today | Where |
| --- | --- | --- |
| Quarters | `Math.ceil(possessionNumber / (possessionsPerGame / 4))` — a display label only | `simulateGame.ts` `getPeriodLabel` |
| Minutes played | `(possessionsOnCourt / possessionsPerGame) * 48` | `boxScore.ts` `deriveBoxScore` |
| Clutch time | last 5% of the period's possessions, margin ≤ 5 | `possession/variance.ts` `isClutchTime` |
| Fatigue | flat gain/recovery per possession | `rotation/fatigue.ts` `tickFatigue` |
| Substitutions | evaluated every possession | `rotation/substitution.ts` |

So "time" is entirely a linear re-scaling of possession count. That is why the substitution
heuristic expresses target minutes as a *share*: `rotationMinutes[id] / REGULATION_MINUTES` compared
against `possessionsPlayed / possessionsElapsed`.

The good news: the possession log already carries `homeOnCourtIds` / `awayOnCourtIds` on every
entry and is documented as the sole source of truth for who was on the floor. Adding elapsed time to
that record is a natural extension, not a redesign.

## 2. Pace doubles (settled)

`possessionsPerGame` defaults to **100**, and it counts *total* possessions — offense strictly
alternates home/away by parity. So each team gets **~50 possessions per game**. The real NBA is ~100
per team.

Points-per-possession is already realistic. Observed scoring in a live run was ~61 ppg, which is
~1.2 PPP across 50 possessions — right at NBA average. The possession *model* is fine; there are
simply half as many possessions as a real game.

This blocks a realistic clock outright:

```
2880 seconds of regulation / 100 total possessions = 28.8 s per possession
```

Longer than a 24-second shot clock. Doubling to ~200 lands everything at once:

```
2880 / 200 = 14.4 s per possession    → realistic
~100 possessions/team × ~1.2 PPP      → ~115 ppg, realistic, no scoring re-tune needed
```

The code change is one default. The cost is tuning: every rotation and fatigue constant is
denominated in possessions and was tuned against the 100-possession pace. `constants.ts` says so
outright —

> Tuned so a continuously-playing average-durability player hits `FATIGUE_SUB_OUT_THRESHOLD` (80)
> after roughly an 18-possession shift (~8.6 minutes at the default 100-possession pace)

At 200 possessions that same shift becomes ~4.3 minutes. Affected: `FATIGUE_GAIN_BASE`,
`FATIGUE_RECOVERY_BASE`, `MIN_SHIFT_POSSESSIONS`, `PACE_CHECK_MIN_POSSESSIONS`. The right end state
is to redenominate these **in seconds**, which the clock work makes possible anyway.

## 3. The position-locked invariant is what we're removing

Today the on-court five is always exactly one PG, one SG, one SF, one PF, one C — by construction.
`checkSubstitutions` only considers bench players whose first listed position matches the outgoing
player's:

```ts
.filter((p) => p.positions[0] === position)
```

`buildMatchups` then sorts both fives by position and pairs by index. `applyYouthMovement`
(`run/variation/houseRules.ts`) preserves the same invariant deliberately.

Free-form fives (Decision 2) remove this. The replacement idea that makes it tractable:

> **The chart's slot becomes the authoritative position.** A player charted into the C slot guards
> the opposing C slot and is evaluated as a C, regardless of what `positions[0]` says.

This gives `buildMatchups` something to pair on again without inventing a fuzzy best-fit assignment
pass. AI teams (no chart) get slot = `positions[0]`, exactly today's behavior.

**The load-bearing refactor** is therefore that on-court state stops being a bag of players and
becomes slot-assigned:

```ts
RotationState.onCourt: Player[]  →  { player: Player, slot: Position }[]
```

That ripples into `findAtPosition`, `checkSubstitutions`, `buildMatchups`, the possession log's
on-court ids, and the UI's `splitRoster` (which sorts starters by `positions[0]` and should sort by
charted slot). It is the single biggest code change in this feature and worth doing on its own,
before any penalty math or UI exists.

## 4. Positional versatility (Decision 2)

Generation gives us most of the raw material already.

**Position is single-valued in practice.** `Player.positions` is typed `Position[]` but
`generatePlayer` always emits `positions: [position]`. Secondary positions are available as a
concept but have never been populated — so affinity has to be derived from height and attributes,
*or* generation starts emitting real secondary positions. Recommend deriving, and treating a
populated second entry as an explicit override when it exists.

**Height ranges are already well-defined and overlapping** (`randomPlayer.ts`):

| Position | Range | |
| --- | --- | --- |
| PG | 72–76" | 6'0"–6'4" |
| SG | 74–78" | 6'2"–6'6" |
| SF | 77–81" | 6'5"–6'9" |
| PF | 80–84" | 6'8"–7'0" |
| C | 82–88" | 6'10"–7'4" |

These validate the intuition directly. A 6'9" SF is at 81" — inside PF's range (80–84), one inch
short of C's floor (82), so PF is free and C is a mild stretch. A 6'3" PG is at 75" — two inches
below SF's floor, so that slide bites. Exactly the described behavior, with no new data needed.

**`POSITION_BIAS` is a ready-made demand vector.** It already encodes what each position *is* in
attribute terms (C: +15 inside/rebounding/interior D, −15 outside/handling). Scoring a player's
tools against the target position's bias gives the third component for free.

### Penalty model — three components

1. **Slide distance.** Delta on the `POSITION_ORDER` index (PG=0 … C=4). Asymmetric on purpose:
   sliding *up* (smaller → bigger) is gated by size and strength; sliding *down* is gated by speed
   and lateral quickness. One slot is minor, two is significant, three-plus is severe.
2. **Height fit.** Compare `heightInches` against the target slot's range. Inside = free. Below the
   floor while playing up, or above the ceiling while playing down, scales the penalty by how many
   inches out of band.
3. **Attribute fit.** Score the player's tools against `POSITION_BIAS[targetSlot]`. A PG with real
   rebounding and interior defense slides to SF better than one without.

### Where the penalty applies

**As a transient effective-attribute shift, not a new term threaded through the sim.** Everything
downstream — `computeOffenseStrength`, `computeResistance`, `playerSelector`'s scorers,
`rotationValue` — reads `player.attributes` directly. Building an adjusted `Player` for an
out-of-position player and passing *that* into the possession propagates the penalty everywhere with
zero call-site changes.

There is direct precedent: consumables already "build transient, boosted roster/team copies for that
season's games only" (`RunState.activeConsumablesThisSeason`). Same pattern, per-possession scope.

Two rules for it:
- The adjusted copy is never persisted and never recomputes `overallRating` (display-only field, and
  the sim is barred from reading it anyway).
- The penalty is **demand-weighted, not uniform** — dock the attributes the new slot leans on, not
  the player's whole line. A PG at C should lose rebounding and interior defense effectiveness, not
  their passing.

### Player quirks — derive, don't store

**Do not add a `Player.quirks` field.** PR #9 (`src/ui/playerTags.ts`) already established the house
position on this, and its doc comment is explicit:

> There is no per-player quirk field in the data model -- PlayerHiddenTraits and PlayerDevelopment
> already *are* the per-player variation, they were just never surfaced anywhere. This file names
> them [...] without inventing a parallel system the simulation doesn't read.

Positionless and Specialist should follow the same rule and be **derived from data that already
exists**, not stored:

- **Positionless**: height sits inside more than one position band, and the attribute profile is
  balanced rather than spiked. A player who is genuinely 6'7" with no glaring hole *is* positionless
  — nothing needs to be written down for that to be true.
- **Specialist**: height sits at the extreme of a single band, or the attribute profile is sharply
  spiked toward one position's `POSITION_BIAS`.

This is strictly better than a stored field: it needs no schema change, so it does not break saves,
and it cannot drift out of sync with the player it describes.

The one real difference from `playerTags` is that these must be **read by the simulation**, not just
displayed — `playerTags` is deliberately display-only. So the derivation belongs in engine code with
a display layer on top, not in `ui/`. Worth reconciling the two so a GM does not see one vocabulary
on the team-reveal card and a different one on the rotation chart.

---

## 5. Other coupling worth knowing

- **No dead balls.** Subs are evaluated on every possession. A chart implies subs at stoppages; no
  such concept exists.
- **Development is downstream.** `aggregateSeasonMinutes` feeds `dpFormula`, so the chart directly
  drives who develops. Good loop for a roguelite — chart mistakes compound across a season.
- **`rotationMinutes` becomes the Auto fallback.** Auto-generated from `ROTATION_DEPTH_WEIGHTS` at
  team creation; still the only input AI teams need.
- **Consumers taking `possessionsPerGame` that need reworking to a clock:** `deriveBoxScore`,
  `getPeriodLabel`, `computeOvertimePossessions`, `isClutchTime`, `generateCoachingInsights`.
- **Saves break, once.** `isValidBundleShape` rejects rather than migrates, and the possession-log
  schema change is exactly that. Deriving quirks rather than storing them (§4) keeps this to a
  single breaking change instead of two. Note PR #8 already touches `runRepository.ts`, so sequence
  this against whatever bundle-shape change lands there.
- **Simcast already exists — in PR #8, unmerged.** `src/ui/simcast/` (`playbackState.ts`,
  `useSimcastPlayback.ts`, `SimcastScreen.tsx`) plus a decomposition of `simulateSeasonChunk` into
  `beginSeason` / `resolveGame` / `finalizeChunk`. Decision 5's overtime prompt targets that real
  playback loop, not a hypothetical one. `simulateGameSteps`' doc comment had already reserved the
  spot: "the pause point future interactive coaching decisions (timeouts, subs, matchup/emphasis
  changes) will hook into."

---

## 6. Build order

The pivot underneath all of this is **going from a possession-counted game to a clock-driven game**:
`for (possession of 1..100)` becomes `while (clock > 0)`. Possessions per game stops being an input
and becomes an outcome.

### Phase A — Real periods
Split regulation into four actual periods instead of one 100-possession block. Per-period jump ball
/ possession arrow. Clutch becomes "late in Q4" rather than "last 5% of the period". Low risk, and
everything after it depends on periods existing.

### Phase B — Possession duration model
Sample each possession's duration in seconds, conditioned on the selected play call:

| Play call | Duration |
| --- | --- |
| `transition` | 4–9 s |
| `pick-and-roll`, `cutting`, `spot-up` | 10–18 s |
| `isolation`, `post-up` | 14–22 s |

Outcome adjusts it: a live-ball turnover truncates early, a make consumes the full sample, a miss
adds rebound time. Target mean ~14.4 s.

Pace then falls out of the playbook mix for free — `sevenSecondsOrLess` genuinely runs more
possessions than `twinTowers`, with no separate pace stat. `pacePresets.possessionsPerGame` gets
repurposed as a league-wide pace multiplier, not a loop bound.

### Phase C — Clock-driven loop
Replace the possession-count loop with a countdown. Redenominate fatigue in seconds. Switch
`deriveBoxScore` to sum real elapsed on-court time, which also deletes the OT approximation in the
current minutes formula. Heaviest phase; expect a full pass over `constants.ts` and the sim tests.

### Phase D — Slot-assigned on-court state
The `onCourt: Player[]` → `{ player, slot }[]` refactor from §3. Pure plumbing, no behavior change
while every slot still matches `positions[0]`. Do it standalone so the diff stays reviewable.

### Phase E — Positional versatility
The penalty model and `Player.quirks` from §4. Independent of the clock — could run in parallel with
A–C — but depends on Phase D for the notion of a slot. Testable in isolation: assert a 6'3" PG at C
is heavily docked and a 6'9" SF at PF is barely touched.

### Phase F — Rotation plan data model

```
RotationPlan = per team, per period, per slot, an ordered list of segments:
  { startSeconds, endSeconds, fill: { kind: 'player', playerId } | { kind: 'auto' } }
```

Authored in game time, evaluated at runtime ("has the clock crossed this boundary?") rather than
precompiled to possession indices — which is why the clock comes first. **Unfilled time is
implicitly Auto**, so a GM can chart only Q1 and Q4 and leave the rest to the coach (Decision 3).

Engine side: `checkSubstitutions` grows a branch that consults the plan when one exists, and falls
through to today's fatigue/pace heuristic for Auto segments and for AI teams.

### Phase G — The chart editor
Timeline UI: five slot lanes, four quarters across, drag to set boundaries, mark spans Auto. Needs
live validation — total team-minutes, per-player totals, empty slots, an out-of-position penalty
badge, and a projected-fatigue overlay so the GM can see they've charted someone into the ground.

Natural home is `MyTeamScreen`: already the always-available roster surface, already owns the
minutes/focus controls this supersedes for the user's team.

### Phase H — Deviation and edge rules
Overtime handling (Decision 5), exhausted charted players, and eventually foul trouble and injuries
(neither exists yet). Deviations surface through Coaching Insights, which already exists as exactly
that channel.

---

## 7. Decisions settled

1. **Pace** — double total possessions to ~200. §2.
2. **Free-form fives** with a scaling out-of-position penalty driven by slide distance, height fit
   and attribute fit, plus Positionless / Specialist player quirks. §4.
3. **Authoritative chart with Auto segments.** Charted spans are law; unfilled or explicitly-Auto
   spans fall through to the coach heuristic. Lets a GM own Q1 and Q4 and ignore the middle.
4. **AI teams get no charts** — they keep the existing fatigue/pace heuristic.
5. **Overtime** — normal sim carries the Q4 closing five. Simcast prompts for substitutions at the
   start of each overtime period.

## 8. Open questions

- **Penalty magnitude.** How punishing is a two-slot slide in practice? Needs a tuning pass against
  real lineups once Phase E exists — the model shape is settled, the numbers are not.
- **Quirk derivation thresholds.** Where are the cutoffs for Positionless / Specialist, given
  they're derived rather than rolled (§4)? Too loose and free-form lineups stop having a cost.
- **Vocabulary overlap with `playerTags` (PR #9).** Both name per-player variation for the GM. Decide
  whether positional quirks join that tag list or stay a separate concept on the chart.
- **Does the GM see the penalty numerically,** or only as a qualitative badge (green / amber / red)
  on the chart? Numeric is more honest, qualitative keeps the editor readable.
- **Secondary positions.** Start populating `positions[1]` at generation as an explicit affinity
  override, or leave affinity fully derived from height and attributes?
