import { describe, expect, it } from 'vitest'
import type { Game, Player } from '../data/types'
import { OVERTIME_MINUTES, REGULATION_MINUTES } from './constants'
import { generateTeam } from './generator/randomTeam'
import { createSeededRng } from './rng'
import { OVERTIME_SECONDS, PERIOD_SECONDS } from './constants'
import { formatGameClock, getPeriodLabel, rollJumpBall, simulateGame, simulateGameSteps } from './simulateGame'

function buildMatchup(seed: number) {
  const home = generateTeam({
    name: 'Home',
    city: 'Home City',
    abbreviation: 'HOM',
    primaryColor: '#000',
    secondaryColor: '#fff',
    offensiveStrategyId: 'motion',
    defensiveStrategyId: 'manToMan',
    rng: createSeededRng(seed),
  })
  const away = generateTeam({
    name: 'Away',
    city: 'Away City',
    abbreviation: 'AWY',
    primaryColor: '#111',
    secondaryColor: '#eee',
    offensiveStrategyId: 'isoHeavy',
    defensiveStrategyId: 'switchEverything',
    rng: createSeededRng(seed + 1),
  })
  const playersById = new Map<string, Player>()
  ;[...home.players, ...away.players].forEach((p) => playersById.set(p.id, p))
  return { home: home.team, away: away.team, playersById }
}

function emptyGame(homeTeamId: string, awayTeamId: string): Game {
  return {
    id: 'game-1',
    leagueId: 'league-1',
    homeTeamId,
    awayTeamId,
    date: new Date().toISOString(),
    isPlayed: false,
    result: null,
    possessionLog: [],
    isSaved: false,
  }
}

describe('simulateGame', () => {
  it('runs a possession count in the neighbourhood of the league pace rather than exactly it', () => {
    const { home, away, playersById } = buildMatchup(10)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 200, createSeededRng(99))

    // Pace is emergent now: the clock decides how many trips fit, so the count varies with the
    // playbook mix and the sampled durations rather than landing on the configured number.
    expect(game.possessionLog.length).toBeGreaterThan(150)
    expect(game.possessionLog.length).toBeLessThan(260)
    expect(game.isPlayed).toBe(true)
  })

  it('plays four regulation periods that each run their clock out', () => {
    const { home, away, playersById } = buildMatchup(10)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 200, createSeededRng(99))

    const regulation = game.possessionLog.filter((e) => e.period <= 4)
    expect(new Set(regulation.map((e) => e.period))).toEqual(new Set([1, 2, 3, 4]))

    for (const period of [1, 2, 3, 4]) {
      const entries = game.possessionLog.filter((e) => e.period === period)
      // Durations sum to the full period, and the last possession leaves nothing on the clock.
      expect(entries.reduce((sum, e) => sum + e.durationSeconds, 0)).toBeCloseTo(PERIOD_SECONDS, 5)
      expect(entries[entries.length - 1].clockSecondsRemaining).toBeCloseTo(0, 5)
    }
  })

  it('never lets a possession overrun the period clock', () => {
    const { home, away, playersById } = buildMatchup(12)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 200, createSeededRng(31))

    for (const entry of game.possessionLog) {
      expect(entry.durationSeconds).toBeGreaterThan(0)
      expect(entry.clockSecondsRemaining).toBeGreaterThanOrEqual(0)
    }
  })

  it('alternates offense strictly within each period, every period (including the opening tip) starting from its own jump ball', () => {
    const { home, away, playersById } = buildMatchup(11)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 200, createSeededRng(5))

    // Every period gets its own jump ball, so nothing forces home to start on offense -- just that
    // the ball changes hands on every attempt EXCEPT one the offense rebounded, which keeps it.
    // Grouping by the logged period is what makes this checkable without re-deriving boundaries.
    const byPeriod = new Map<number, typeof game.possessionLog>()
    for (const entry of game.possessionLog) {
      byPeriod.set(entry.period, [...(byPeriod.get(entry.period) ?? []), entry])
    }

    for (const entries of byPeriod.values()) {
      entries.forEach((entry, i) => {
        if (i === 0) return
        const previous = entries[i - 1]
        if (previous.offensiveRebound) {
          // Second chance: same team shoots again, and the entry is flagged as such.
          expect(entry.offenseTeamId).toBe(previous.offenseTeamId)
          expect(entry.isSecondChance).toBe(true)
        } else {
          expect(entry.offenseTeamId).not.toBe(previous.offenseTeamId)
          expect(entry.isSecondChance).toBe(false)
        }
      })
    }
  })

  it('records which slot each on-court player was filling, not just who was out there', () => {
    const { home, away, playersById } = buildMatchup(13)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 200, createSeededRng(17))

    for (const entry of game.possessionLog) {
      for (const five of [entry.homeOnCourt, entry.awayOnCourt]) {
        expect(five).toHaveLength(5)
        // One of each slot, every possession -- substitutions fill a slot rather than adding one.
        expect(new Set(five.map((o) => o.slot)).size).toBe(5)
      }
    }

    // The slot is recorded, not re-derived: a reader can recover the assignment without consulting
    // Player.positions at all, which is what makes the log survive an out-of-position lineup.
    const first = game.possessionLog[0]
    expect(first.homeOnCourt.every((o) => typeof o.slot === 'string' && o.playerId.length > 0)).toBe(true)
  })

  it('only rebounds its own misses, and second chances are quick putbacks', () => {
    const { home, away, playersById } = buildMatchup(11)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 200, createSeededRng(5))

    const offensiveRebounds = game.possessionLog.filter((e) => e.offensiveRebound)
    expect(offensiveRebounds.length).toBeGreaterThan(0)
    // Only a miss can be rebounded by the offense -- a make is inbounded, a turnover hands over,
    // and a foul stops play for free throws.
    expect(offensiveRebounds.every((e) => e.outcome === 'miss')).toBe(true)

    const secondChances = game.possessionLog.filter((e) => e.isSecondChance)
    expect(secondChances.length).toBe(offensiveRebounds.length)
    // A putback is a shot already under the rim, not a fresh trip, so it costs far less clock.
    const putbackMean = secondChances.reduce((sum, e) => sum + e.durationSeconds, 0) / secondChances.length
    const tripMean =
      game.possessionLog.filter((e) => !e.isSecondChance).reduce((sum, e) => sum + e.durationSeconds, 0) /
      game.possessionLog.filter((e) => !e.isSecondChance).length
    expect(putbackMean).toBeLessThan(tripMean / 2)
  })

  it("rollJumpBall is a neutral coin flip, not fixed to either team", () => {
    // Across many seeds, the opening tip should go to each team a meaningful share of the time --
    // this would fail if the jump ball were ever accidentally hardcoded back to "home always starts."
    const { home, away, playersById } = buildMatchup(50)
    let homeWonTip = 0
    const trials = 200
    for (let seed = 0; seed < trials; seed++) {
      const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 20, createSeededRng(seed))
      if (game.possessionLog[0].offenseTeamId === home.id) homeWonTip += 1
    }
    expect(homeWonTip).toBeGreaterThan(trials * 0.3)
    expect(homeWonTip).toBeLessThan(trials * 0.7)
  })

  it('final score matches the sum of points logged for each team', () => {
    const { home, away, playersById } = buildMatchup(12)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 100, createSeededRng(3))
    // No outcome filter: pointsScored is 0 on everything except a make or a converted shooting
    // foul, so summing the whole log is the score -- same way simulateGame accumulates it.
    const homePoints = game.possessionLog
      .filter((e) => e.offenseTeamId === home.id)
      .reduce((sum, e) => sum + e.pointsScored, 0)
    const awayPoints = game.possessionLog
      .filter((e) => e.offenseTeamId === away.id)
      .reduce((sum, e) => sum + e.pointsScored, 0)

    expect(game.result!.homeScore).toBe(homePoints)
    expect(game.result!.awayScore).toBe(awayPoints)
    expect(game.result!.homeScore).toBeGreaterThan(0)
    expect(game.result!.awayScore).toBeGreaterThan(0)
  })

  it('box score points sum to the final score, free throws included', () => {
    // Two independent paths add points now -- simulateGame accumulates resolved.pointsScored onto
    // the scoreboard while deriveBoxScore re-adds entry.pointsScored onto player lines. A make
    // credits the shooter in one place and a converted foul in another, so they can silently drift.
    const { home, away, playersById } = buildMatchup(12)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 100, createSeededRng(11))
    const { boxScore, homeScore, awayScore } = game.result!

    expect(boxScore.home.reduce((sum, l) => sum + l.points, 0)).toBe(homeScore)
    expect(boxScore.away.reduce((sum, l) => sum + l.points, 0)).toBe(awayScore)
  })

  it('converts shooting fouls into free throws that score', () => {
    const { home, away, playersById } = buildMatchup(12)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 100, createSeededRng(5))
    const fouls = game.possessionLog.filter((e) => e.outcome === 'foul')

    expect(fouls.length).toBeGreaterThan(0)
    // Two free throws on a two-point attempt, three on a three -- and points equal what dropped.
    for (const entry of fouls) {
      expect(entry.freeThrowsAttempted).toBe(entry.isThreePointAttempt ? 3 : 2)
      expect(entry.freeThrowsMade).toBeLessThanOrEqual(entry.freeThrowsAttempted)
      expect(entry.pointsScored).toBe(entry.freeThrowsMade)
    }
    expect(fouls.some((e) => e.pointsScored > 0)).toBe(true)
  })

  it('is reproducible given the same rosters and seeded rng', () => {
    // Substitution/fatigue logic (engine/rotation) takes no rng at all -- it's fully deterministic
    // given the possession sequence -- so this invariant holds automatically post-rotation.
    const { home, away, playersById } = buildMatchup(20)
    const gameA = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 50, createSeededRng(7))
    const gameB = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 50, createSeededRng(7))
    expect(gameA.result).toEqual(gameB.result)
  })

  it('gives more than 5 distinct players per team court time over a full game', () => {
    const { home, away, playersById } = buildMatchup(30)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 100, createSeededRng(15))
    expect(game.result!.boxScore.home.length).toBeGreaterThan(5)
    expect(game.result!.boxScore.away.length).toBeGreaterThan(5)
  })

  it('conserves possessions-played: every possession credits exactly 5 players per team', () => {
    const { home, away, playersById } = buildMatchup(31)
    const possessionsPerGame = 100
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, possessionsPerGame, createSeededRng(16))

    game.possessionLog.forEach((entry) => {
      expect(entry.homeOnCourt).toHaveLength(5)
      expect(entry.awayOnCourt).toHaveLength(5)
      expect(new Set(entry.homeOnCourt).size).toBe(5)
      expect(new Set(entry.awayOnCourt).size).toBe(5)
    })

    // Total possessions actually run can exceed possessionsPerGame if the game went to overtime --
    // the "exactly 5 credited per team, every possession" invariant holds regardless.
    const homeOnCourtOccurrences = game.possessionLog.reduce((sum, e) => sum + e.homeOnCourt.length, 0)
    const awayOnCourtOccurrences = game.possessionLog.reduce((sum, e) => sum + e.awayOnCourt.length, 0)
    expect(homeOnCourtOccurrences).toBe(game.possessionLog.length * 5)
    expect(awayOnCourtOccurrences).toBe(game.possessionLog.length * 5)
  })

  it("keeps every player's minutesPlayed within [0, regulation + any overtime]", () => {
    const { home, away, playersById } = buildMatchup(32)
    const possessionsPerGame = 100
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, possessionsPerGame, createSeededRng(17))
    const maxPossibleMinutes = REGULATION_MINUTES + game.result!.overtimePeriods * OVERTIME_MINUTES
    ;[...game.result!.boxScore.home, ...game.result!.boxScore.away].forEach((line) => {
      expect(line.minutesPlayed).toBeGreaterThanOrEqual(0)
      expect(line.minutesPlayed).toBeLessThanOrEqual(maxPossibleMinutes + 1e-9)
    })
  })

  describe('overtime', () => {
    it('never ends in a tie, and every overtime period runs a full five minutes', () => {
      const { home, away, playersById } = buildMatchup(40)
      let sawOvertime = false

      for (let seed = 0; seed < 300; seed++) {
        const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 200, createSeededRng(seed))
        expect(game.result!.homeScore).not.toBe(game.result!.awayScore)

        const overtimePeriods = new Set(game.possessionLog.filter((e) => e.period > 4).map((e) => e.period))
        expect(overtimePeriods.size).toBe(game.result!.overtimePeriods)

        for (const period of overtimePeriods) {
          const entries = game.possessionLog.filter((e) => e.period === period)
          expect(entries.reduce((sum, e) => sum + e.durationSeconds, 0)).toBeCloseTo(OVERTIME_SECONDS, 5)
        }

        if (game.result!.overtimePeriods > 0) sawOvertime = true
      }

      expect(sawOvertime).toBe(true)
    })
  })
})

describe('simulateGameSteps', () => {
  it('yields exactly one step per possession and returns a result equivalent to simulateGame for the same seed', () => {
    const { home, away, playersById } = buildMatchup(60)
    const possessionsPerGame = 40
    const game = emptyGame(home.id, away.id)

    const steps = simulateGameSteps(game, home, away, playersById, possessionsPerGame, createSeededRng(21))
    const yielded: { entry: { possessionNumber: number }; homeScore: number; awayScore: number }[] = []
    let next = steps.next()
    while (!next.done) {
      yielded.push(next.value)
      next = steps.next()
    }
    const drainedGame = next.value

    const directGame = simulateGame(game, home, away, playersById, possessionsPerGame, createSeededRng(21))

    expect(drainedGame).toEqual(directGame)
    expect(yielded).toHaveLength(directGame.possessionLog.length)
  })

  it('reports a running score at each step that matches a recomputation from the log up to that point', () => {
    const { home, away, playersById } = buildMatchup(61)
    const possessionsPerGame = 40
    const steps = simulateGameSteps(
      emptyGame(home.id, away.id),
      home,
      away,
      playersById,
      possessionsPerGame,
      createSeededRng(22),
    )

    let runningHome = 0
    let runningAway = 0
    let next = steps.next()
    while (!next.done) {
      const { entry, homeScore, awayScore } = next.value
      if (entry.offenseTeamId === home.id) runningHome += entry.pointsScored
      else runningAway += entry.pointsScored
      expect(homeScore).toBe(runningHome)
      expect(awayScore).toBe(runningAway)
      next = steps.next()
    }
  })

  it('does not throw when .next() is called again after the generator is already done', () => {
    const { home, away, playersById } = buildMatchup(62)
    const steps = simulateGameSteps(emptyGame(home.id, away.id), home, away, playersById, 20, createSeededRng(23))
    let next = steps.next()
    while (!next.done) next = steps.next()
    expect(() => steps.next()).not.toThrow()
  })
})

describe('getPeriodLabel', () => {
  it('labels regulation quarters and successive overtimes', () => {
    expect(getPeriodLabel(1)).toBe('Q1')
    expect(getPeriodLabel(4)).toBe('Q4')
    expect(getPeriodLabel(5)).toBe('OT')
    expect(getPeriodLabel(6)).toBe('2OT')
  })
})

describe('formatGameClock', () => {
  it('renders mm:ss, rounding up so a live possession never shows 0:00 early', () => {
    expect(formatGameClock(PERIOD_SECONDS)).toBe('12:00')
    expect(formatGameClock(65)).toBe('1:05')
    expect(formatGameClock(0.4)).toBe('0:01')
    expect(formatGameClock(0)).toBe('0:00')
  })
})

describe('rollJumpBall', () => {
  it('returns true (home wins) below 0.5 and false (away wins) at or above it', () => {
    expect(rollJumpBall(() => 0.49)).toBe(true)
    expect(rollJumpBall(() => 0.5)).toBe(false)
    expect(rollJumpBall(() => 0.99)).toBe(false)
  })
})
