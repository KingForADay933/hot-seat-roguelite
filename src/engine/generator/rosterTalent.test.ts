import { describe, expect, it } from 'vitest'
import type { Player, Team } from '../../data/types'
import { generateLeague } from './randomLeague'
import { createSeededRng } from '../rng'

/**
 * The shape of a generated roster, which nothing measured until it was badly wrong.
 *
 * Attributes used to be rolled independently, so `overallRating` -- the mean of ten of them -- had
 * its spread crushed by the central limit theorem to a standard deviation of 3.53. Two consequences,
 * both asserted below:
 *
 *  - **Stars could not exist.** 0.30% of players reached 82 and nobody ever reached 90. Since the run
 *    hands the GM the league's *worst* roster on purpose (run/assignWorstTeam.ts), the team actually
 *    played had no 82+ player 99.2% of the time.
 *  - **The depth chart was noise.** With no talent structure, which player was best at a position was
 *    chance, so a doubled-up position benched its second-best above some other position's starter on
 *    **86.8%** of teams.
 *
 * ROSTER_TALENT_LADDER fixed both by giving each depth-chart rung an offset applied to all ten
 * attributes at once. Asserted as shape rather than as exact numbers -- the ladder's values are
 * tuning and should stay free to move; what must not come back is a flat league or a random depth
 * chart.
 */
interface TeamView {
  five: Player[]
  bench: Player[]
  roster: Player[]
}

function leagues(count: number): TeamView[] {
  const out: TeamView[] = []
  for (let seed = 0; seed < count; seed++) {
    const rng = createSeededRng(seed + 1)
    const { teams, players } = generateLeague({ teamCount: 8, leagueName: 'L', rng, seasonLength: 16 })
    const byId = new Map(players.map((p) => [p.id, p]))
    teams.forEach((team: Team) => {
      const roster = team.rosterPlayerIds.map((id) => byId.get(id)!).filter(Boolean)
      const fiveIds = new Set(team.startingFive)
      out.push({ roster, five: roster.filter((p) => fiveIds.has(p.id)), bench: roster.filter((p) => !fiveIds.has(p.id)) })
    })
  }
  return out
}

describe('generated roster shape', () => {
  const views = leagues(40)
  const share = (f: (v: TeamView) => boolean) => views.filter(f).length / views.length

  it('puts the best players in the starting five on the large majority of teams', () => {
    // Measured at 14.6% of teams having any bench player above any starter, against 86.8% before.
    // A band rather than zero on purpose: real rosters have good sixth men, and a depth chart with
    // no overlap at all reads artificial and removes any reason to look at the bench.
    const outranked = share((v) => Math.max(...v.bench.map((p) => p.overallRating)) > Math.min(...v.five.map((p) => p.overallRating)))
    expect(outranked).toBeLessThan(0.3)
    expect(outranked).toBeGreaterThan(0.02)
  })

  it('keeps the overlap small when it does happen', () => {
    // Measured at 5.1% of teams. The complaint was never that a sixth man can be good -- it was
    // starters being outranked by several points, which is what reads as a generation bug.
    const bigGap = share((v) => Math.max(...v.bench.map((p) => p.overallRating)) - Math.min(...v.five.map((p) => p.overallRating)) >= 3)
    expect(bigGap).toBeLessThan(0.15)
  })

  it('gives almost every team a player worth building around', () => {
    // The 2K reading this was retuned against: a team with nobody at 82 is a lost cause. Measured at
    // 95.4%, against 3.7% before.
    expect(share((v) => v.roster.some((p) => p.overallRating >= 82))).toBeGreaterThan(0.85)
  })

  it('keeps genuine superstars rare', () => {
    // The other end of the same dial. An early ladder put a 90+ on 85% of teams, which makes a
    // superstar unremarkable; measured at 11% now. Nobody reached 90 at all before this existed.
    const has90 = share((v) => v.roster.some((p) => p.overallRating >= 90))
    expect(has90).toBeGreaterThan(0.02)
    expect(has90).toBeLessThan(0.3)
  })

  it('spreads ratings widely enough for a roster to have a shape', () => {
    // sd was 3.53 across the whole league, so every player read as the same player. The point of the
    // ladder is that a roster has a top and a bottom.
    const all = views.flatMap((v) => v.roster.map((p) => p.overallRating))
    const mean = all.reduce((s, x) => s + x, 0) / all.length
    const sd = Math.sqrt(all.reduce((s, x) => s + (x - mean) ** 2, 0) / all.length)
    expect(sd).toBeGreaterThan(5)
    expect(mean).toBeGreaterThan(70)
    expect(mean).toBeLessThan(80)
  })

  it('leaves the starting five clearly better than the bench on average', () => {
    const starters = views.flatMap((v) => v.five.map((p) => p.overallRating))
    const bench = views.flatMap((v) => v.bench.map((p) => p.overallRating))
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    expect(mean(starters) - mean(bench)).toBeGreaterThan(6)
  })
})
