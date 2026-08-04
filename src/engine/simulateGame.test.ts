import { describe, expect, it } from 'vitest'
import type { Game, Player } from '../data/types'
import { OVERTIME_MINUTES, REGULATION_MINUTES } from './constants'
import { generateTeam } from './generator/randomTeam'
import { createSeededRng } from './rng'
import { computeOvertimePossessions, rollJumpBall, simulateGame, simulateGameSteps } from './simulateGame'

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
  it('produces exactly one possession log entry per configured possession', () => {
    const { home, away, playersById } = buildMatchup(10)
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 100, createSeededRng(99))
    expect(game.possessionLog).toHaveLength(100)
    expect(game.isPlayed).toBe(true)
  })

  it('alternates offense strictly within each period, every period (including the opening tip) starting from its own jump ball', () => {
    const { home, away, playersById } = buildMatchup(11)
    const possessionsPerGame = 20
    const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, possessionsPerGame, createSeededRng(5))

    // Regulation's opening tip is a jump ball too now, so nothing forces home to start on offense --
    // just that every possession strictly alternates from whichever team won that period's tip.
    game.possessionLog
      .filter((e) => e.possessionNumber <= possessionsPerGame)
      .forEach((entry, i, regulationEntries) => {
        if (i === 0) return
        expect(entry.offenseTeamId).not.toBe(regulationEntries[i - 1].offenseTeamId)
      })

    // Overtime periods (if any) each start fresh off their own jump ball -- not necessarily aligned
    // to regulation's pattern -- but still strictly alternate possession-to-possession within a period.
    const overtimePossessions = computeOvertimePossessions(possessionsPerGame)
    const overtimeEntries = game.possessionLog.filter((e) => e.possessionNumber > possessionsPerGame)
    overtimeEntries.forEach((entry, i) => {
      const positionInPeriod = i % overtimePossessions
      if (positionInPeriod === 0) return // first possession of a period may repeat the prior period's last offense
      expect(entry.offenseTeamId).not.toBe(overtimeEntries[i - 1].offenseTeamId)
    })
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
    const homePoints = game.possessionLog
      .filter((e) => e.offenseTeamId === home.id && e.outcome === 'make')
      .reduce((sum, e) => sum + e.pointsScored, 0)
    const awayPoints = game.possessionLog
      .filter((e) => e.offenseTeamId === away.id && e.outcome === 'make')
      .reduce((sum, e) => sum + e.pointsScored, 0)

    expect(game.result!.homeScore).toBe(homePoints)
    expect(game.result!.awayScore).toBe(awayPoints)
    expect(game.result!.homeScore).toBeGreaterThan(0)
    expect(game.result!.awayScore).toBeGreaterThan(0)
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
      expect(entry.homeOnCourtIds).toHaveLength(5)
      expect(entry.awayOnCourtIds).toHaveLength(5)
      expect(new Set(entry.homeOnCourtIds).size).toBe(5)
      expect(new Set(entry.awayOnCourtIds).size).toBe(5)
    })

    // Total possessions actually run can exceed possessionsPerGame if the game went to overtime --
    // the "exactly 5 credited per team, every possession" invariant holds regardless.
    const homeOnCourtOccurrences = game.possessionLog.reduce((sum, e) => sum + e.homeOnCourtIds.length, 0)
    const awayOnCourtOccurrences = game.possessionLog.reduce((sum, e) => sum + e.awayOnCourtIds.length, 0)
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
    it('never ends in a tie, and the possession log length always matches regulation + full overtime periods', () => {
      const { home, away, playersById } = buildMatchup(40)
      const possessionsPerGame = 100
      const overtimePossessions = computeOvertimePossessions(possessionsPerGame)
      let sawOvertime = false

      for (let seed = 0; seed < 300; seed++) {
        const game = simulateGame(
          emptyGame(home.id, away.id),
          home,
          away,
          playersById,
          possessionsPerGame,
          createSeededRng(seed),
        )
        expect(game.result!.homeScore).not.toBe(game.result!.awayScore)
        expect(game.possessionLog).toHaveLength(possessionsPerGame + game.result!.overtimePeriods * overtimePossessions)
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
      if (entry.outcome === 'make') {
        if (entry.offenseTeamId === home.id) runningHome += entry.pointsScored
        else runningAway += entry.pointsScored
      }
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

describe('computeOvertimePossessions', () => {
  it('computes 5/12 of a quarter at the same pace as regulation', () => {
    expect(computeOvertimePossessions(96)).toBe(10) // 96/4=24 possessions/quarter, 5/12*24=10 exactly
  })

  it('rounds to the nearest whole possession for the default 100-possession pace', () => {
    expect(computeOvertimePossessions(100)).toBe(10) // 5/48*100=10.4167 -> rounds to 10
  })

  it('floors at 1 possession so a period can never be zero-length', () => {
    expect(computeOvertimePossessions(4)).toBe(1) // 4/4=1/quarter, 5/12*1=0.4167 -> rounds to 0, floored to 1
  })
})

describe('rollJumpBall', () => {
  it('returns true (home wins) below 0.5 and false (away wins) at or above it', () => {
    expect(rollJumpBall(() => 0.49)).toBe(true)
    expect(rollJumpBall(() => 0.5)).toBe(false)
    expect(rollJumpBall(() => 0.99)).toBe(false)
  })
})
