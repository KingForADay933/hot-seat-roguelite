import { describe, expect, it } from 'vitest'
import type { Game } from '../data/types'
import { generateLeague } from './generator/randomLeague'
import { createSeededRng } from './rng'
import { simulateGame } from './simulateGame'

/**
 * Guards the shot model against silent drift away from real basketball. Every constant feeding a
 * score -- pace, make probability, the three-point penalty, foul rate, free-throw conversion --
 * lands here, so a tuning change that looks harmless in isolation gets caught by the box score it
 * actually produces.
 *
 * Bounds are deliberately loose. This is a "still recognisably basketball" check, not a lock on the
 * current numbers; tightening it would make every future balance change a test edit.
 */
function playLeagues(leagues: number, gamesPerLeague: number) {
  const scores: number[] = []
  let trips = 0
  let games = 0
  let fgm = 0
  let fga = 0
  let tpm = 0
  let tpa = 0
  let ftm = 0
  let fta = 0
  let offensiveRebounds = 0
  let rebounds = 0
  let steals = 0
  let blocks = 0
  let turnovers = 0

  for (let seed = 0; seed < leagues; seed++) {
    const rng = createSeededRng(seed + 1)
    const { teams, players } = generateLeague({ teamCount: 8, leagueName: 'L', rng, seasonLength: 16 })
    const playersById = new Map(players.map((p) => [p.id, p]))

    for (let i = 0; i < gamesPerLeague; i++) {
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
      const played = simulateGame(blank, home, away, playersById, 200, rng)

      scores.push(played.result!.homeScore, played.result!.awayScore)
      // A trip, not a logged attempt: an offensive rebound keeps the ball, so one trip can span
      // several entries. Pace is quoted in trips, the way real possession counts are.
      trips += played.possessionLog.filter((e) => !e.isSecondChance).length / 2
      offensiveRebounds += played.possessionLog.filter((e) => e.offensiveRebound).length
      games += 1
      for (const line of [...played.result!.boxScore.home, ...played.result!.boxScore.away]) {
        fgm += line.fieldGoalsMade
        fga += line.fieldGoalsAttempted
        tpm += line.threePointersMade
        tpa += line.threePointersAttempted
        ftm += line.freeThrowsMade
        fta += line.freeThrowsAttempted
        rebounds += line.rebounds
        steals += line.steals
        blocks += line.blocks
        turnovers += line.turnovers
      }
    }
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  return {
    mean,
    possessionsPerTeam: trips / games,
    fieldGoalAttemptsPerTeam: fga / (games * 2),
    offensiveReboundsPerTeam: offensiveRebounds / (games * 2),
    reboundsPerTeam: rebounds / (games * 2),
    stealsPerTeam: steals / (games * 2),
    blocksPerTeam: blocks / (games * 2),
    turnoversPerTeam: turnovers / (games * 2),
    /** Share of turnovers a defender is credited for -- the rest are unforced. */
    stealShareOfTurnovers: steals / turnovers,
    /** Blocks per field-goal attempt, the rate real box scores are usually quoted against. */
    blocksPerAttempt: blocks / fga,
    fgPct: fgm / fga,
    threePct: tpm / tpa,
    /** Everything that wasn't a three, so the two-vs-three difficulty gap is directly checkable. */
    twoPct: (fgm - tpm) / (fga - tpa),
    freeThrowPct: ftm / fta,
    freeThrowsPerTeam: fta / (games * 2),
    share: (predicate: (score: number) => boolean) => scores.filter(predicate).length / scores.length,
  }
}

describe('scoring calibration', () => {
  const league = playLeagues(4, 40)

  it('scores like a real league on average', () => {
    // Real NBA sits at ~115 a team.
    expect(league.mean).toBeGreaterThan(105)
    expect(league.mean).toBeLessThan(125)
  })

  it('runs a realistic number of possessions', () => {
    // Real NBA is ~99 a team a game. Trips, not logged attempts -- offensive rebounds keep the ball.
    expect(league.possessionsPerTeam).toBeGreaterThan(92)
    expect(league.possessionsPerTeam).toBeLessThan(108)
  })

  it('takes a realistic number of shots, because second chances supply the extra attempts', () => {
    // The reason offensive rebounds had to become retained possession: at one shot per trip the
    // engine took ~80 attempts a team where a real one takes ~89, and the make rate had to be
    // inflated to ~59% on twos to compensate. Now both the attempts and the percentage are real.
    expect(league.fieldGoalAttemptsPerTeam).toBeGreaterThan(82)
    expect(league.fieldGoalAttemptsPerTeam).toBeLessThan(95)
    // Real league shoots ~53% on twos.
    expect(league.twoPct).toBeGreaterThan(0.48)
    expect(league.twoPct).toBeLessThan(0.6)
  })

  it('rebounds at a realistic rate on both ends', () => {
    // Real NBA is ~10 offensive and ~43 total a team.
    expect(league.offensiveReboundsPerTeam).toBeGreaterThan(6)
    expect(league.offensiveReboundsPerTeam).toBeLessThan(15)
    expect(league.reboundsPerTeam).toBeGreaterThan(35)
    expect(league.reboundsPerTeam).toBeLessThan(52)
  })

  it('keeps 140-point games rare and sub-90 games rare', () => {
    // Both sit near 2% of team-games in the real league. The roguelite deliberately generates a
    // wider talent spread than the NBA has, so the bounds allow more than that but not many more.
    expect(league.share((s) => s >= 140)).toBeLessThan(0.08)
    expect(league.share((s) => s < 90)).toBeLessThan(0.08)
  })

  it('makes threes meaningfully harder than twos', () => {
    // The regression this exists for: without a difficulty penalty a three was strictly better than
    // a two -- same make chance, more points -- and jump-shooting systems scored 150 a night at 61%
    // from deep. The real gap is ~17 points of percentage.
    expect(league.threePct).toBeLessThan(league.twoPct - 0.1)
    expect(league.threePct).toBeGreaterThan(0.3)
    expect(league.threePct).toBeLessThan(0.5)
  })

  it('sends teams to the line at a plausible rate and converts realistically', () => {
    expect(league.freeThrowsPerTeam).toBeGreaterThan(12)
    expect(league.freeThrowsPerTeam).toBeLessThan(28)
    // Real league free-throw percentage is ~78%.
    expect(league.freeThrowPct).toBeGreaterThan(0.68)
    expect(league.freeThrowPct).toBeLessThan(0.86)
  })
})

describe('defensive stat calibration', () => {
  const league = playLeagues(4, 40)

  it('credits steals at a believable rate, and never more than there were turnovers', () => {
    // Real NBA sits around 7-8 steals a team a game.
    expect(league.stealsPerTeam).toBeGreaterThan(4)
    expect(league.stealsPerTeam).toBeLessThan(12)
    // Steals are a subset of turnovers by construction -- the rest are unforced, with nobody to
    // credit. A team's steals matching the opponent's turnovers exactly would mean every giveaway
    // was forced, which is the bug this guards against.
    expect(league.stealShareOfTurnovers).toBeGreaterThan(0.3)
    expect(league.stealShareOfTurnovers).toBeLessThan(0.85)
  })

  it('credits blocks at a believable rate against attempts', () => {
    // Real NBA is ~5 blocks a team a game, against ~89 attempts -- a bit under one in twenty.
    expect(league.blocksPerTeam).toBeGreaterThan(2)
    expect(league.blocksPerTeam).toBeLessThan(9)
    expect(league.blocksPerAttempt).toBeGreaterThan(0.02)
    expect(league.blocksPerAttempt).toBeLessThan(0.12)
  })
})
