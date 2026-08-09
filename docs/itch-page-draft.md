# itch.io page — draft

**Milestone:** M0 in `HotSeatFeatureTiers.md`'s Build Order.
**Status:** Draft. Page to be created **unpublished / restricted-link**, not released.

**This document holds two versions of the page.**

| Section | Describes | Safe to publish? |
| --- | --- | --- |
| [Store copy — current build](#store-copy--current-build) | The build as it stands today | **Yes** |
| [Capture notes](#capture-notes) | Screenshot and GIF direction for the above | production notes, not page text |
| [Where the copy strains](#where-the-copy-strains) | What the current build can't claim, and why | internal |
| [Target-state copy — after M7](#target-state-copy--after-m7) | The build once the whole roadmap ships | **No — describes features that do not exist** |

The current version is written against today's build deliberately, not against what's planned. The
point of doing this at M0 is to find out where the pitch strains while there's still time to do
something about it.

The target-state version exists to answer a different question: is the roadmap worth building? Read
the two side by side — the comparison at the end of this document is more useful than either draft
alone.

---

## Store copy — current build

**Publishable.** Describes only what exists in the build today.

### Title

**HOT SEAT**

> Naming is still open in the design doc (Section 0), with Waiver Wire as the co-leader. Hot Seat
> matches this copy's tone better; Waiver Wire is the sharper name but implies roster churn the game
> doesn't have yet. If Tier 15 ships, that flips.

### Tagline

> Take the worst job in basketball. Try to keep it.

### Short description

*(itch's "short description" field — shows in listings and search, ~150 chars)*

> You've been handed the worst team in the league and a target you probably can't hit. A basketball GM roguelite about surviving, not winning.

### Body

> You didn't get this job because they thought you were good. You got it because nobody else wanted it.
>
> Eight teams. Thirty-two games. The worst roster in the league, and an owner who wants a top-half finish inside three seasons. Hit it and the bar goes up. Miss it and you're done — no save-scumming, no second file. A season plays in under ten minutes.
>
> **The hand you're dealt.**
> Market size is assigned, not chosen. Big market: money, no patience — two seasons a stretch. Small market: broke, but they'll wait four. Then a roster quirk and a house rule, two cards each, pick one of each. Stacked at guard with nothing at center. One aging superstar carrying a roster of rookies. A short bench — eight players, nowhere to hide from fatigue.
>
> **Your answer.**
> Nine offensive systems, four on the table, pick one. Twin Towers runs everything through the post. Seven Seconds or Less pushes on every possession. Princeton is backdoor cuts and patience.
>
> The catch: the system is scored against the roster you actually have, using the same attributes the simulation reads. Draft Twin Towers onto a guard-heavy roster and the number tells you exactly how bad an idea it is — then lets you do it anyway.
>
> **The season.**
> Thirty-two games in four chunks. At each checkpoint the game tells you what it noticed: who's getting pulled with heavy fatigue, whose minutes don't match their role, which of your decisions got overridden and why. Adjust, and keep going.
>
> **Watch it, or don't.**
> Sim a game in a second, or watch it possession by possession — real clock, real quarters, live box score, commentary calling it as it happens. Pace isn't a slider; it falls out of the plays your system runs. If it goes to overtime, the game stops and waits for you.
>
> **Coach it.**
> A rotation chart, five slots by four quarters. Drag out exactly who's on the floor and when. Play a point guard at center if you want — it'll let you, then show you what it costs. Each position has forty-eight minutes to give and not one more.
>
> **Spend it.**
> Wins pay. Send a player to camp and pick the attribute yourself. Buy a coaching upgrade — one per run, permanent. Hold consumables in a three-slot inventory and decide which season is worth burning them on.
>
> **Then get fired.**
> Eventually you will.

### What this isn't

*(Keep this. It pre-empts the first comment you'll get and turns a gap into positioning.)*

> There are no trades, no free agency, no draft. You get the roster you're given and the few levers the shop sells you. If you want to run a franchise for twenty years, this isn't that game.

### Tech line

> Runs in the browser. Saves locally — one run at a time, and getting fired is the end of it.

---

## Capture notes

Production direction, not page text.

### Screenshots

Seven, in page order.

| # | Screen | What must be in frame | Caption |
| --- | --- | --- | --- |
| 1 | Team Reveal | Roster-shape depth table **and** at least three system cards showing *different* synergy numbers | "Four systems on the table. The number is how well each one fits the roster you actually have." |
| 2 | Simcast, late | Q4, under three minutes, margin inside five, 3-4 commentary lines, on-court panel | "Q4, two minutes left, four down." |
| 3 | Rotation chart | Several segments assigned, at least one red out-of-position badge, summary panel with fatigue projections | "Five slots, four quarters. The red flag means you've put someone somewhere he doesn't belong." |
| 4 | Checkpoint | The Coaching Insights list, several entries | "What the game noticed while you weren't looking." |
| 5 | Shop | Camps, coaching upgrades and consumables together in one frame | "Wins pay. You decide where it goes." |
| 6 | Roster sheet | Attribute table with green headroom numbers, minutes-by-position readout at top | "Green is how much room is left before he hits his ceiling." |
| 7 | Fired | — | "Four seasons. It was the fourth one that did it." |

Screenshot 1 is the thesis of the game in a single image; if only one static shot survives, it's that
one. Screenshot 2 needs a genuinely close game — retry the draft-to-watch flow until one turns up
rather than grabbing a blowout.

**Deliberately not screenshotted: the box score.** See the strain notes below.

### GIFs

Three, in descending order of importance.

1. **Simcast in motion** — 8-12s, looping. The most important asset on the page: it's the only thing
   that proves this is a live simulation rather than a spreadsheet with a scoreboard. Start the
   capture on a made three so the score moves inside the first second. Clock ticking, commentary
   appearing line by line, box-score numbers incrementing. **Record at 1x, not sped up** — the point
   is that it feels like a broadcast.
2. **A rotation chart drag** — 6-8s. Select a segment, assign a player, then drag a boundary, with
   the fatigue projection row and charted-minutes numbers visibly updating *as the drag happens*.
   Those live-updating numbers are the "there's a real model underneath this" signal, and a static
   shot can't carry it.
3. **The system draft** — 5-6s. Cycling the four cards with the synergy number and per-play-call
   breakdown changing on each. The core build decision in one gesture.

### Visual positioning

The game is visually plain — dark theme, dense tables. That's normal for the genre and not worth
apologising for; Basketball GM and Out of the Park sell on information density *as* the aesthetic.
But it does mean the page lives or dies on GIF #1. Budget the time accordingly: one good simcast
capture is worth more than all seven screenshots.

---

## Where the copy strains

Three problems surfaced while writing this, all of which map onto the Build Order.

**The fantasy has no ceiling.** There is no way to write "win a championship" or even "make the
playoffs," because neither exists — the best available stake is "finish top half," and nobody dreams
about finishing top half. This is the strongest argument for Tier 12 (M4), and a better one than the
"the season ends flat" framing it was scheduled on: the problem isn't only that the season stops
abruptly, it's that **the pitch has no summit**.

**"Then get fired" is the best line in the copy and it currently pays off with nothing.** The run
ends and there's no verdict. That line writes a cheque Tier 8 has to cash — which is exactly why the
run-end summary sits in M1.

**The box score can't be shown.** No steals, no blocks; a sim audience reads that instantly. A box
score is a natural thing to want on a page like this, and right now it's a liability rather than an
asset. Tier 11 (M1) turns it into screenshot #8.

**Re-run this document after M1.** If the copy above still needs the "What this isn't" disclaimer to
hold together, that's information. If it reads clean without straining, everything after M1 is a
deliberate choice to make the game better rather than a debt being paid off — which is the whole
reason M0 comes first.

---

## Target-state copy — after M7

> ⚠️ **NOT FOR PUBLICATION.** Every paragraph below describes at least one feature that does not
> exist yet. This is here to answer "is the roadmap worth building," not to go on a page. Do not
> paste any of it into itch until the milestone it depends on has actually shipped.

Assumes the whole Build Order has landed: M1 through M7, including playoffs and graduated
expectations (Tier 12), live coaching (Tier 13, all four levels), and attrition (Tiers 14 and 15's
scheduled half). **Assumes free agency and trades have *not* shipped** — Tier 15's acquisition half
is still gated on M2, and including it would change the positioning rather than extend it. See
[If free agency ships](#if-free-agency-ships) below.

### Title

**HOT SEAT** — but revisit this at M5. With retirement and poaching shipped, **Waiver Wire** stops
being a name that overpromises roster churn and starts being an accurate one. The design doc's
Section 0 still has both as co-leaders; that question gets easier to answer once attrition exists.

### Tagline

> Take the worst job in basketball. The better you do, the worse it gets.

### Short description

> A basketball GM roguelite. Take over the league's worst team, survive the target they set you, and watch the bar rise until it kills you.

### Body

> You didn't get this job because they thought you were good. You got it because nobody else wanted it.
>
> The worst roster in the league. An owner who'll settle for a top-half finish this season — and won't settle for it again.
>
> **The reward for succeeding is a higher bar.**
> Finish top half and they want the playoffs. Make the playoffs and they want a round. Win a round and they want the conference finals. Keep this up long enough and nothing short of a title keeps you employed — which you'll be chasing with a roster that's aged four years, lost its best young player to a team with more money, and just watched its starting center go down in March.
>
> **The hand you're dealt.**
> Market size is assigned, not chosen. Big market: money, no patience — two seasons a stretch. Small market: broke, but they'll wait four. Then a roster quirk and a house rule, two cards each, pick one of each. Stacked at guard with nothing at center. One aging superstar carrying a roster of rookies. A short bench — eight players, nowhere to hide.
>
> **Your answer.**
> Nine offensive systems, four on the table, pick one. Twin Towers runs everything through the post. Seven Seconds or Less pushes on every possession. Princeton is backdoor cuts and patience.
>
> The catch: the system is scored against the roster you actually have, using the same attributes the simulation reads. Draft Twin Towers onto a guard-heavy roster and the number tells you exactly how bad an idea it is — then lets you do it anyway.
>
> **Now coach it.**
> Watch a game possession by possession and change it while it's happening. Call a timeout when the run's going the wrong way. Switch to zone against a team that can't shoot. Put your best defender on their best scorer. Pull the guy in foul trouble before he fouls out — or leave him in and find out.
>
> **Chart it.**
> Five slots, four quarters, painted out by hand. Decide exactly who's on the floor and when, down to the minute. Play a point guard at center if you want — it'll let you, then show you what it costs. Every position has forty-eight minutes to give and not one more.
>
> **Then lose them anyway.**
> Players get hurt. Players foul out. Players get old and retire. The young forward you spent three seasons developing signs somewhere with a real budget. Rosters refill from a rookie pool and you get a pick, which is not the same as getting a replacement.
>
> **And then a verdict.**
> However it ends — fired in year three, or a banner and a contract extension — the game reconstructs it. Not a score screen: an explanation, assembled from what actually happened possession by possession. Which rotation killed you. Which signing saved you. Which night in February you should have called a timeout.
>
> **Then get fired.**
> Eventually you will.

### What this isn't (revised)

The current disclaimer ("no trades, no free agency, no draft") goes stale at M5 — there *is* turnover
by then, and there *is* a rookie pick. Revised version:

> There's no trade deadline and no free-agent market. Players leave — they retire, they get poached, they get hurt — and you get a rookie pick to backfill. What you don't get is a way to shop your way out of a bad roster. If you want to run a franchise for twenty years, this isn't that game.

That still works as positioning rather than apology: the absence of a transaction market is the
reason the pressure exists.

### What changes on the page

Four new screenshots earn a place, and one existing exclusion is lifted:

- **The bracket** — your seed, your path, how far you got. The shot that says "there's something to win here," which the current page has no way to say.
- **The verdict screen** — the run summary mid-scroll, showing a causal chain rather than a stat dump.
- **A timeout, mid-game** — simcast paused, scheme selector open, score close. Static, but it communicates agency instantly.
- **The box score** — finally shippable with steals and blocks. Goes from liability to asset.

The GIF order changes, which is the real tell:

1. **Live coaching**, 10-12s — paused mid-run, switch to zone, resume, watch the next three possessions play differently. Displaces the plain simcast as the hero asset, because it shows the same living game *plus* your hand on it.
2. **The bracket advancing** — a series resolving, seeds moving.
3. Simcast in motion, demoted to third.

### If free agency ships

Tier 15's acquisition half would change the positioning, not just add to it. The "What this isn't"
section largely dissolves, and the pitch moves toward conventional GM-game territory — which is a
more crowded shelf. The current copy's distinctiveness comes substantially from what it *refuses* to
let you do. Worth weighing that against the M2 playtest feedback before committing, and worth
rewriting this section rather than bolting a bullet onto it.

---

## What the comparison tells you

Reading the two drafts side by side is more useful than either alone.

**The current pitch has one verb: survive.** The target pitch has three — survive, contend, and
coach. That isn't a longer feature list, it's a different genre position. The first reads as a
punishing niche curio; the second as a game with a summit and a skill ceiling.

**Two milestones do almost all the work.** M4 gives the pitch a summit — the escalation paragraph,
now the second thing a reader sees, is unwritable without it. M6 gives it agency, and "now coach it"
is the strongest paragraph in either draft. Everything else adds texture.

**The scope-discipline finding, and it's worth acting on:** M3 alone — mid-game scheme and focus
switching — already lets you write *"switch to zone against a team that can't shoot."* M6 adds
timeouts, live substitutions and matchups, which make that paragraph richer, but M3 is what gets you
through the door. At 8-12 days against 15-20, **M3 is the highest pitch-value-per-day item on the
roadmap and M6 is the lowest.**

That is not an argument to cut M6. It's an argument that if the calendar slips — and M6 is the item
flagged as most likely to — you can ship a page that reads nearly this well without it, and land M6
as the update that earns a second wave of attention. Better outcome than delaying launch for it.

**What doesn't show up:** M1 and M2 are nearly invisible in the target copy. The run-end summary earns
the "verdict" paragraph and defensive stats unlock one screenshot; that's all. Not an argument
against them — a flat ending and a broken box score would be *noticed* even though they don't sell —
but worth knowing that **M1 and M2 are hygiene, and M3 through M6 are the pitch.**
