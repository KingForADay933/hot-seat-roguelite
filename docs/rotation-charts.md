# Rotation Charts — groundwork

Planning notes for a 2K-style rotation chart: a per-quarter timeline where the GM maps out exactly
who is on the floor, when, and for how long. Nothing here is built yet. This document records what
the engine does today, what has to change, in what order, and the decisions already settled.

Written against master as of the simcast (#8) and team-reveal/system-fit (#9) merges.

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

### Phase A — Real periods
Four actual periods instead of one 100-possession block. Per-period jump ball. Clutch becomes "late
in Q4". **Put the period on `SimulationStep`** so the simcast stops diffing labels. Low risk, and
everything after depends on periods existing.

### Phase B — Possession duration model
Sample each possession's duration in seconds, conditioned on the selected play call:

| Play call | Duration |
| --- | --- |
| `transition` | 4–9 s |
| `pick-and-roll`, `cutting`, `spot-up` | 10–18 s |
| `isolation`, `post-up` | 14–22 s |

Outcome adjusts: live-ball turnover truncates early, a make consumes the full sample, a miss adds
rebound time. Target mean ~14.4 s.

Pace then falls out of the playbook mix for free — `sevenSecondsOrLess` genuinely runs more
possessions than `twinTowers`, no separate pace stat. `pacePresets.possessionsPerGame` becomes a
league-wide pace multiplier, not a loop bound.

### Phase C — Clock-driven loop
Countdown instead of a possession count. Fatigue in seconds. Minutes summed from real elapsed time
in **both** `deriveBoxScore` and `playbackState`. Retune `BASE_POSSESSION_MS`. Heaviest phase;
expect a full pass over `constants.ts` and the sim tests.

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

### Phase E — Positional versatility
The penalty model and derived quirks (§4). Independent of the clock, depends on D for the notion of a
slot. Testable in isolation: assert a 6'3" PG at C is heavily docked, a 6'9" SF at PF barely touched,
and — the interesting one — that a badly-slotted lineup drops the team's projected synergy.

### Phase F — Rotation plan data model

```
RotationPlan = per team, per period, per slot, an ordered list of segments:
  { startSeconds, endSeconds, fill: { kind: 'player', playerId } | { kind: 'auto' } }
```

Authored in game time, evaluated at runtime against the clock. **Unfilled time is implicitly Auto**,
so a GM can chart Q1 and Q4 and leave the rest to the coach (Decision 3). It reaches the engine via
`Team`, which already flows through `ChunkSimContext`.

`checkSubstitutions` grows a branch consulting the plan when one exists, falling through to today's
fatigue/pace heuristic for Auto segments and AI teams. `availability()` can then stop approximating:
with a chart, who is on the floor when is known exactly rather than inferred from target minutes.

### Phase G — The chart editor
Five slot lanes, four quarters across, drag to set boundaries, mark spans Auto. Live validation:
team-minutes total, per-player totals, empty slots, an out-of-position penalty badge, and a
projected-fatigue overlay. Natural home is `MyTeamScreen`, which already owns the minutes/focus
controls this supersedes for the user's team.

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

- **Penalty magnitude.** How punishing is a two-slot slide? Model shape is settled, numbers are not.
  Tune against real lineups once Phase E exists, watching the synergy knock-on as well as the
  per-possession effect.
- **Quirk derivation thresholds.** Where are the Positionless / Specialist cutoffs, given they're
  derived rather than rolled? Too loose and free-form lineups stop having a cost.
- **Does the GM see the penalty numerically,** or as a green/amber/red badge? Numeric is honest,
  qualitative keeps the editor readable. `PlayerRevealCard` already has a tag vocabulary to match.
- **Secondary positions.** Start populating `positions[1]` at generation as an explicit affinity
  override, or leave affinity fully derived from height and role fit?
- **Does the chart feed synergy continuously, or only at stretch boundaries?** Continuous is more
  correct; boundary-only avoids a recompute on every drag in the editor.
