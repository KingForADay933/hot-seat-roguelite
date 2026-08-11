import { describe, expect, it } from 'vitest'
import type { Player } from '../../data/types'
import { deriveDepthChart } from '../../engine/depthChart'
import { generateLeague } from '../../engine/generator/randomLeague'
import { createSeededRng } from '../../engine/rng'
import { applyRosterQuirk } from './rosterQuirks'

/**
 * What a roster quirk does to the depth chart, measured rather than assumed.
 *
 * The assumption worth recording, because it was wrong: quirks reshape the GM's roster after
 * generation -- `frontcourt-overload` shifts bigs +12 and guards -12 -- and nothing recomputed
 * `startingFive` afterwards, which looked like an obvious cause of bench players out-rating starters
 * on the GM's own team. It is not. A position tilt moves every player at a position by the same
 * amount, so it preserves the ordering *within* each position, and the five is the best at each
 * position -- so the lineup comes back the same. Measured over 60 rosters per quirk, re-deriving
 * changes the five 2/60 times for `stacked-guards` and 0/60 for every other quirk.
 *
 * What the tilt quirks *do* cause is real but structural, and asserted below: with one starter per
 * position, boosting the backcourt +12 while nerfing the frontcourt -12 leaves the backup guard
 * rated above the starting centre on **every** roster. No re-derive can fix that -- the nerfed centre
 * is still the best centre on the team -- and it is arguably the quirk working as described ("Elite
 * backcourt, thin frontcourt"). It is a property of POSITION_TILT, not of the depth chart.
 */
function userRoster(seed: number): Player[] {
  const rng = createSeededRng(seed)
  const { teams, players } = generateLeague({ teamCount: 2, leagueName: 'L', rng })
  const byId = new Map(players.map((p) => [p.id, p]))
  return teams[0].rosterPlayerIds.map((id) => byId.get(id)!).filter(Boolean)
}

const TILTS = ['frontcourt-overload', 'stacked-guards'] as const
const NEUTRAL = ['live-by-three', 'defense-first', 'high-variance'] as const
const SEEDS = [1, 2, 3, 4, 5, 6]

/** Whether any bench player out-rates the weakest starter -- a cross-position comparison, since
 *  within a position the starter is the best by construction. */
function benchOutranksStarter(roster: Player[], startingFive: string[]): boolean {
  const five = new Set(startingFive)
  const starters = roster.filter((p) => five.has(p.id))
  const bench = roster.filter((p) => !five.has(p.id))
  if (starters.length === 0 || bench.length === 0) return false
  return Math.max(...bench.map((p) => p.overallRating)) > Math.min(...starters.map((p) => p.overallRating))
}

describe('the depth chart after a roster quirk', () => {
  it('never leaves a starter out-rated by a player at his own position', () => {
    // The invariant the re-derive exists to hold, whatever a quirk did to the attributes.
    for (const quirk of [...TILTS, ...NEUTRAL]) {
      for (const seed of SEEDS) {
        const tilted = applyRosterQuirk(quirk, userRoster(seed), createSeededRng(seed))
        const byId = new Map(tilted.map((p) => [p.id, p]))

        for (const id of deriveDepthChart(tilted).startingFive) {
          const starter = byId.get(id)!
          const rivals = tilted.filter((p) => p.positions[0] === starter.positions[0])
          expect(starter.overallRating).toBe(Math.max(...rivals.map((p) => p.overallRating)))
        }
      }
    }
  })

  it('leaves a quirk that does not tilt positions with a clean depth chart', () => {
    // The generation fix carries through: a skill-shape or variance quirk shifts everyone the same
    // way or only touches the ends, so the ordered depth chart survives it on most rosters.
    const dirty = NEUTRAL.flatMap((quirk) =>
      SEEDS.map((seed) => {
        const q = applyRosterQuirk(quirk, userRoster(seed), createSeededRng(seed))
        return benchOutranksStarter(q, deriveDepthChart(q).startingFive)
      }),
    ).filter(Boolean).length
    expect(dirty / (NEUTRAL.length * SEEDS.length)).toBeLessThan(0.4)
  })

  it('documents that a position tilt puts a backup above a starter by construction', () => {
    // Not a bug to fix here, and deliberately asserted so it cannot change silently: this is
    // POSITION_TILT's 24-point swing meeting a one-starter-per-position lineup. If a future pass
    // softens the tilt or lets the lineup float off position, this test is where that shows up.
    for (const quirk of TILTS) {
      const affected = SEEDS.filter((seed) => {
        const q = applyRosterQuirk(quirk, userRoster(seed), createSeededRng(seed))
        return benchOutranksStarter(q, deriveDepthChart(q).startingFive)
      }).length
      expect(affected).toBe(SEEDS.length)
    }
  })
})
