# Detailed Simcast — Court View (planning notes)

Planning notes for the labeled-circles-on-a-court version of the simcast: players and the ball moving
in something closer to real time, rendered from the same possession log the text broadcast already
reads. This document records what exists today to build on, what's genuinely new, the constraint that
shapes the whole design, and a proposed build order. Nothing here is built yet.

This is the deep-dive doc for the feature specifically — it corresponds to **Tier 7.7** in
`HotSeatFeatureTiers.md`, the project-wide feature catalog and build order. `rotation-charts.md` is
the other deep-dive doc in this repo; the two don't overlap, but Section 5 below leans on some of the
same engine plumbing (slot-assigned on-court state) that rotation-charts.md built.

**This was already the plan, once.** Hoop Sim's own design doc —
`Basketball Manager Game - Design Document.md`, Section 7, "Simcast (Visual Playback)" — specified
almost exactly this, before Tier 7.5 shipped the text version under the same name:

> Simple 2D top-down court view — dots/icons representing players, in the style of Front Office
> Football / OOTP. Simcast does **not** run its own simulation. It **renders the possession log**
> that was already generated — a "puppet show" driven by stored data, not a parallel simulation...
> only *movement/animation* within a possession could vary cosmetically if desired later — not
> required for v1.

That's the mandate this doc operationalizes: a rendering layer over an already-resolved,
already-deterministic possession log. Not a second simulation.

---

## 0. What already exists (the foundation this builds on)

- **`simulateGameSteps` is already a lazy, one-possession-at-a-time generator.** Each `.next()`
  computes exactly one possession against current rotation/fatigue/RNG state and yields it; nothing
  past the cursor has been computed yet. Its own doc comment names this as deliberate: yielding one
  possession at a time "is the pause point future interactive coaching decisions (timeouts, subs,
  matchup/emphasis changes) will hook into." Tier 7.5's overtime prompt is the first real use of that
  pause point; Tier 13 (`HotSeatFeatureTiers.md`) is the planned second one, via `.next(directive)`.
- **`PossessionLogEntry` already carries what a choreography layer needs** (`src/data/types/game.ts`):
  both teams' full on-court five *with slot* (`homeOnCourt`/`awayOnCourt`, `OnCourtRecord[]`),
  `primaryPlayerId`/`secondaryPlayerIds` (the same actors the commentary text already names —
  screener/roller, passer/cutter, depending on `playCallUsed`), `playCallUsed` (6 values),
  `outcome`/`isThreePointAttempt`/`offensiveRebound`/`isSecondChance`, and `durationSeconds` (real
  game-clock time for that trip).
- **`useSimcastPlayback` already has a pause-and-resume state machine** (`playing` / `paused` /
  `awaiting-substitutions` / `final`) that stops the interval mid-broadcast without losing state —
  direct precedent for this feature needing its own pacing without breaking anything upstream.
- **Zero spatial data exists anywhere today.** `Position` (`PG`–`C`) is a role label, not a court
  location — there is no x/y anywhere in the engine or the data model.
- **`SLOT_INTERIOR_LEAN`** (`engine/constants.ts`) already scores each slot's distance from the
  basket on a 0–1 scale (PG 0 → C 1, evenly spaced), for the out-of-position penalty's demand
  weighting (rotation-charts.md Phase E). It's a ready-made anchor for one axis of a court coordinate
  system — see §2 — rather than inventing a parallel "how interior is this slot" concept.

---

## 1. The hard constraint: possessions stay individually generated

This is the requirement flagged going in, and it deserves to be stated as a rule, not a preference,
because a future feature's architecture depends on it.

**Why it matters:** Tier 13's entire plan for in-game coaching decisions is teaching
`simulateGameSteps`'s yield point to accept a directive via `.next(directive)` — a value arrives as
the *input* to the next possession's resolution, not a mutation of state the generator owns in its
closure. That design only works if nothing has consumed possessions ahead of wherever the GM currently
is in the broadcast. If this feature ever pre-computes or pre-renders possession *N+5*'s movement
while the GM is still watching possession *N* — a lookahead buffer for smoother animation, a "preview
the next play" feature, a batch "compute the whole game's choreography up front" shortcut for
performance — then the moment Tier 13 lands and a directive changes rotation or scheme after
possession *N*, possession *N+5* has already been generated against the wrong state. Either the
buffer is silently wrong, or it has to be invalidated and redone, which defeats the entire point of
the generator's laziness that Tier 7.5 and Tier 13 both already depend on.

**The rule:** choreography for possession *N* is generated only once possession *N*'s `SimulationStep`
has actually been pulled from the generator — i.e., once it has actually been decided — and never
before. No lookahead queue, no pre-rendering upcoming possessions, no "warm the animation cache at
broadcast start" shortcut.

This mirrors a rule the codebase already follows: `skipToEnd` is the one place that legitimately drains
the generator ahead of the render cursor, and it already bypasses rendering entirely when it does (see
§4). Everything else pulls exactly one possession at a time, in order, and renders only what it just
pulled.

**What this does and doesn't block:** replaying a possession that already happened — scrubbing back to
watch possession 40's movement again — is fine, because that possession is immutable history sitting
in the possession log. Previewing a possession that hasn't happened yet is not, both because the data
doesn't exist and because, once Tier 13 ships, it may not resolve the same way twice depending on a
directive the GM hasn't issued yet.

---

## 2. The coordinate model

Nothing spatial exists today, so this is new. Proposed shape, kept as simple as the rest of the engine
model:

- **Normalized half-court**, since only the offense's attacking end is ever visually relevant for a
  given possession. `x` = sideline to sideline, `y` = baseline (0) to half-court (50-ish, arbitrary
  units — the renderer scales to whatever SVG viewBox it draws). Offense always attacks toward `y=0`
  in the model regardless of which team is on offense or which real "side" they're on — the renderer
  flips the visual only if it wants to show the actual home/away ends; the choreography layer never
  needs to care.
- **Depth axis reuses `SLOT_INTERIOR_LEAN` directly**, rather than inventing a second "how close to
  the rim" scale: a slot's baseline `y` anchor is `SLOT_INTERIOR_LEAN[slot]` scaled into the half-court
  range, so PG starts at the top of the key and C starts on the block, matching the same lean the
  out-of-position penalty already uses. One number, two consumers, no drift between "how interior a
  slot plays" and "where it starts."
- **A small zone table for the cross-axis** (`x`), since interior lean alone doesn't distinguish a
  strong-side wing from a weak-side corner: PG top-of-key center, SG strong-side wing/corner, SF
  weak-side wing, PF elbow/short corner, C block. Five anchors, not a full grid — this is a starting
  formation per possession, not a physics field.
- **Defense mirrors the man it's guarding.** Matchups already pair slot-to-slot
  (`matchup.ts buildMatchups`, extended by rotation-charts.md's slot-assigned on-court state), so a
  defender's anchor is simply its matched offensive slot's anchor, offset toward the rim by a fixed
  amount. No separate defensive zone table needed for a first cut — see §9 on scheme-specific defense.

---

## 3. Choreography: possession entry → waypoint sequence

A pure function, `choreographPossession(entry: PossessionLogEntry): { players: Map<PlayerId,
Waypoint[]>, ball: Waypoint[] }`, seeded deterministically off data already on the entry
(`possessionNumber` is unique across the whole game) rather than fresh `Math.random()` at render
time — consistent with the determinism discipline the rest of the codebase holds to (`createSeededRng`,
and rotation-charts.md's own note that "seed-reproducibility has been a constraint throughout"). Same
possession log, same movement, every time it's rendered.

**Templates keyed by `playCallUsed`** (the 6 existing values), using `primaryPlayerId` and
`secondaryPlayerIds` exactly as the commentary generator already does — ball movement gets a reason
tied to the same actors the broadcast text names, instead of being arbitrary:

| Play call | Sketch |
| --- | --- |
| pick-and-roll | primary brings the ball up top, secondary screens near the elbow, primary drives or kicks to the rolling secondary |
| isolation | primary works one-on-one at their zone anchor; no secondary movement |
| post-up | primary/secondary already read as a low-post duo; ball enters the block |
| spot-up | secondary starts with the ball, primary relocates to their zone, catch-and-shoot at the end |
| cutting | secondary starts with the ball, primary cuts toward the rim |
| transition | fast up-court movement from a wide outlet position to the rim |

**End point keyed to outcome:** `isThreePointAttempt` places the primary's final waypoint beyond an
arc radius; otherwise it lands in the paint/mid-range. `turnover` cuts the ball's path short toward a
defender instead of the rim. `foul` stops the action at the attempt spot and moves the ball to the
free-throw line. `offensiveRebound`/`isSecondChance` is a flag for the *next* possession's formation
(start from a scramble, not a clean set) — worth having, not required for a first cut (see §9).

**The other 3-4 on-court players per side have no engine-assigned role in a given possession** — the
sim only names a primary and secondaries. Their movement is pure invented filler (light drift toward
their zone anchor) so the court doesn't look empty, exactly the same kind of cosmetic invention
`ACTION_PHRASES`' flavor text already is around the same real actors. No data backs it and none should
be implied.

---

## 4. Real-time playback and pacing

**The mismatch:** `useSimcastPlayback` pulls exactly one possession per interval tick — 450ms at 1x by
default, tuned for a scrolling text feed. A real possession covers `durationSeconds` of ~14-24
game-clock seconds; reading player movement against that needs on the order of a couple of real
seconds minimum. The two paces have nothing to do with each other today and shouldn't be forced to.

**Proposal:** the court view is an alternate rendering mode over the *same* generator and the *same*
`SimulationStep` stream — not a parallel playback path — but it drives its own pacing once active.
After a step is pulled, its choreography plays out over a fixed wall-clock window (on the order of
1.5-3s at 1x, independent of `durationSeconds`, which is game-clock time and already isn't 1:1 with
wall-clock playback speed today); the *next* pull waits for that window rather than firing on the
existing fixed interval.

**Speed multipliers (1/2/4/16x):** the window shrinks with speed. Past some threshold (4x is a
reasonable first guess) individual movement isn't readable regardless of how fast it's drawn, so above
that the court view should snap straight to each possession's end state instead of trying to animate
faster and faster — the existing text feed already does the equivalent (it just scrolls) and there's
no reason to over-build smooth animation for a speed nobody is watching frame-by-frame.

**`skipToEnd`:** unchanged. It already drains the generator synchronously and bypasses rendering
entirely; the choreography layer simply never runs for possessions consumed that way. This is also
the existing proof that §1's rule is compatible with the codebase as it stands — the one place that
legitimately looks ahead already skips animation rather than trying to animate ahead.

---

## 5. Rendering

**SVG**, for the same reasons the sound/animation feasibility discussion landed on it: no canvas
exists anywhere in this app today, there's already an `icons.svg` precedent, it's trivially scalable,
and eleven moving elements (10 players + ball) is cheap enough that React can own positions
declaratively (`<circle>` per element, position driven by state, movement via CSS transition or a
small `requestAnimationFrame` loop) without reaching for anything heavier.

**Accessibility:** the existing `CommentaryFeed` text narration stays the source of truth. The court
view is decoration layered alongside it — `aria-hidden`, the same way `TeamSwatch`'s color chip already
is next to real text — not a replacement for the accessible feed.

**Reduced motion:** the codebase already has a working pattern for this
(`@media (prefers-reduced-motion: reduce)` on the commentary feed and fatigue bars). For this feature,
"reduced motion" most likely means falling back to the existing static `OnCourtPanel` list entirely
rather than just disabling one CSS transition — worth deciding explicitly in Phase D (§8), not
inferring from the existing narrower pattern.

---

## 6. What doesn't change

Worth stating plainly, because Tier 11 already burned time on the alternative: **this feature adds
nothing to `PossessionLogEntry` and needs no save migration.** Everything the choreography generator
needs is either already logged (§0) or synthesized fresh at render time from those fields. Per Section
7's own "puppet show, not a parallel simulation" principle, this is presentation-layer work — it
belongs in `ui/` (or a new `simcast/`-scoped module), not `engine/`, and `engine/` shouldn't need to
change for it at all. That also means it carries none of the risk the possession-log-shape changes in
Tier 11 do.

---

## 7. Proposed build order

Nothing below is built. Phases are proposed, not committed — a starting shape to sequence work if this
gets picked up.

- **Phase A — Coordinate model.** The zone table and the `SLOT_INTERIOR_LEAN`-based depth axis from
  §2, as pure data plus unit tests. No rendering yet.
- **Phase B — Choreography generator.** `choreographPossession` from §3 as a pure, deterministically-
  seeded function: possession log entry in, waypoints out. Fully unit-testable without any UI, against
  real possession log entries pulled from played games.
- **Phase C — Static renderer.** SVG court + circles rendering a single already-resolved possession's
  waypoints, no playback wiring yet — prove the visual reads correctly before wiring it into a live
  broadcast.
- **Phase D — Playback integration.** Decoupled pacing from §4, added as a new panel/mode in
  `SimcastScreen`, built strictly under §1's rule (generate only what's just been pulled, nothing
  ahead of the cursor). Decide the reduced-motion fallback here, not after the fact.
- **Phase E — Speed and skip interaction.** Multiplier behavior and the snap-to-end-state threshold
  from §4, verified against `skipToEnd`'s existing bypass.

---

## 8. Decisions proposed (not yet settled by building anything)

1. **Cosmetic only, never a parallel simulation.** Directly inherited from Hoop Sim's design doc
   Section 7 — this was decided before this doc existed. Restated here because §1 and §6 both depend
   on it holding.
2. **No possession-log schema changes, no save migration.** §6.
3. **Choreography generation is per-possession and on-demand — never batched or looked ahead.** §1.
   This is the one decision this doc exists to pin down, and it should not be revisited casually: it's
   what keeps this feature and Tier 13 compatible.
4. **Lives in the presentation layer (`ui/`), not `engine/`.** §6.

## 9. Open questions

- **Scheme-specific defense.** §2 proposes defenders simply mirror their matched offensive slot —
  fine for a man-to-man look, but Tier 13 plans to make defensive schemes (already five presets:
  Man-to-Man, Zone, Switch-Everything, Pack-the-Paint, Full-Court Press) switchable mid-game. Building
  rich per-scheme defensive choreography now, against a scheme model that's about to become
  interactive, risks the same "tuned before the model changed" problem Tier 11 already flagged for
  position-fit constants. Recommend deferring scheme-aware defense until Tier 13's scheme switching
  lands, and shipping the fixed man-mirror as a deliberate v1 simplification.
- **How much invented filler is too much.** The 3-4 players per side with no engine-assigned role
  (§3) move on pure flavor. Six play-call templates repeated over a ~200-possession game risks reading
  as same-y; whether that needs deliberate variety injection (still deterministic, just more of it) is
  a call for whoever builds Phase B, informed by watching a real game rather than guessing.
- **Second-chance/putback formation continuity.** Starting the next possession from a "scramble"
  formation when `isSecondChance` is true is a nice touch flagged in §3, not required for a first cut.
- **Exact module location.** `ui/simcast/` (alongside the existing `CommentaryFeed`/`OnCourtPanel`) or
  a new top-level `simcast/` if this grows enough to want engine-adjacent-but-not-engine status. Not
  worth deciding until Phase A actually exists.
- **Interaction with Tier 13 substitutions specifically.** Once mid-game subs are directive-driven
  (Tier 13 level 3), a substitution needs the *next* possession's choreography to reflect the new
  on-court five. This should already be true for free, since choreography is generated fresh per
  possession off that possession's own logged `homeOnCourt`/`awayOnCourt` — never cached or carried
  over from a previous one. Worth a deliberate check when Tier 13 lands, rather than an assumption.

---

## 10. Relationship to Tier 13

This doc and Tier 13 share the same foundational constraint and the same yield point in
`simulateGameSteps`. Building this feature before Tier 13 is fine and doesn't block it — **provided
§1's rule is respected the whole time.** If it's quietly violated later (a lookahead buffer added under
deadline pressure for smoother animation, say), it won't break anything *this* feature does on its
own — it'll surface as Tier 13 becoming much harder to build correctly, in exactly the way a
batch-precomputed game already would be. Worth re-reading §1 before touching this feature's pacing
code, even long after Phase E ships.
