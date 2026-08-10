import { describe, expect, it } from 'vitest'
import type { Game, PlayCallType } from '../data/types'
import { generateLeague } from './generator/randomLeague'
import { createSeededRng } from './rng'
import { simulateGame } from './simulateGame'

/**
 * What each play call is actually worth, which nothing measured until it was badly wrong.
 *
 * Every other test here checks a play call against itself -- that a better handler beats a worse one
 * at pick-and-roll, that the three-point penalty applies. None compared play calls to *each other*,
 * so the engine sat for a long time with the two extremes inverted: transition, the most efficient
 * thing in real basketball, was its worst call at 0.917 points per play, and cutting was fifth of
 * six. Spot-up led at 1.102.
 *
 * That distorted more than the box score. The tactical shot-selection dial moves volume along the
 * rim-to-perimeter axis (engine/tacticalFocus.ts's RIM_LEAN), and that axis ran from the engine's
 * worst play call to its best -- so Hunt Threes won for every system tested and the dial was a
 * setting rather than a decision.
 *
 * The fix was structural, not just tuning: transition scored off the on-court five's mean rebounding
 * and was defended by the opponent's fastest player every single time, cutting had no finishing
 * attribute at all and was treated as a perimeter action by Pack-the-Paint, and make probability was
 * one number for every shot in the game regardless of where it came from. See
 * MAKE_PROB_BASE_BY_PLAY_CALL for the resulting table.
 *
 * Asserted as a shape, not as numbers. The exact values are tuning and should be free to move; what
 * must not come back is rim pressure being worse than jump shooting.
 */
const CALLS: PlayCallType[] = ['pick-and-roll', 'isolation', 'post-up', 'spot-up', 'cutting', 'transition']

function pointsPerPlay() {
  const points = new Map<PlayCallType, number>(CALLS.map((c) => [c, 0]))
  const plays = new Map<PlayCallType, number>(CALLS.map((c) => [c, 0]))

  for (let seed = 0; seed < 3; seed++) {
    const rng = createSeededRng(seed + 1)
    const { teams, players } = generateLeague({ teamCount: 8, leagueName: 'L', rng, seasonLength: 16 })
    const playersById = new Map(players.map((p) => [p.id, p]))

    for (let i = 0; i < 30; i++) {
      const home = teams[i % teams.length]
      const away = teams[(i + 3) % teams.length]
      if (home.id === away.id) continue

      const blank: Game = {
        id: `g${seed}-${i}`,
        leagueId: 'l',
        homeTeamId: home.id,
        awayTeamId: away.id,
        date: '',
        isPlayed: false,
        result: null,
        possessionLog: [],
        isSaved: false,
      }
      for (const e of simulateGame(blank, home, away, playersById, 200, rng).possessionLog) {
        points.set(e.playCallUsed, points.get(e.playCallUsed)! + e.pointsScored)
        plays.set(e.playCallUsed, plays.get(e.playCallUsed)! + 1)
      }
    }
  }

  return Object.fromEntries(CALLS.map((c) => [c, points.get(c)! / plays.get(c)!])) as Record<PlayCallType, number>
}

describe('play call efficiency', () => {
  const ppp = pointsPerPlay()

  it('rewards getting to the rim more than jump shooting', () => {
    // The inversion this file exists for. Measured at cutting 1.18 and transition 1.14 against
    // spot-up 1.07; the margin is wide enough that the ordering is not a coin flip on the sample.
    expect(ppp.cutting).toBeGreaterThan(ppp['spot-up'])
    expect(ppp.transition).toBeGreaterThan(ppp['spot-up'])
  })

  it('makes isolation the least efficient thing an offense can run', () => {
    // Real basketball's least efficient common play type, and the engine's third-best before this.
    for (const call of CALLS) {
      if (call === 'isolation') continue
      expect(ppp.isolation).toBeLessThan(ppp[call])
    }
  })

  it('keeps the half-court calls close together rather than one running away with it', () => {
    // The dial has to be a trade-off. If any single call gets far enough ahead, the shot-selection
    // focus point stops being a decision -- which is exactly the state this replaced.
    const spread = Math.max(...CALLS.map((c) => ppp[c])) - Math.min(...CALLS.map((c) => ppp[c]))
    expect(spread).toBeLessThan(0.35)
  })

  it('leaves every play call worth running', () => {
    // A floor and a ceiling on the whole set: nothing should be so bad that a system built on it is
    // unplayable, nor so good that nothing else is worth calling.
    for (const call of CALLS) {
      expect(ppp[call]).toBeGreaterThan(0.85)
      expect(ppp[call]).toBeLessThan(1.35)
    }
  })
})
