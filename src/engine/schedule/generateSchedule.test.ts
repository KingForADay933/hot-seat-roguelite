import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../rng'
import { generateSchedule } from './generateSchedule'

const teamIds = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']

describe('generateSchedule', () => {
  it('gives every team exactly seasonLength games', () => {
    const games = generateSchedule('league-1', teamIds, 16, createSeededRng(1))
    for (const teamId of teamIds) {
      const count = games.filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId).length
      expect(count).toBe(16)
    }
  })

  it('never schedules a team against itself', () => {
    const games = generateSchedule('league-1', teamIds, 16, createSeededRng(1))
    expect(games.every((g) => g.homeTeamId !== g.awayTeamId)).toBe(true)
  })

  it('handles a season length longer than one double round-robin cycle by wrapping', () => {
    // 8 teams -> 7 rounds per single cycle, 14 per double cycle; 20 forces a wrap.
    const games = generateSchedule('league-1', teamIds, 20, createSeededRng(1))
    for (const teamId of teamIds) {
      const count = games.filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId).length
      expect(count).toBe(20)
    }
  })

  it('produces roughly balanced home/away splits over a full double round-robin cycle', () => {
    const games = generateSchedule('league-1', teamIds, 14, createSeededRng(1))
    for (const teamId of teamIds) {
      const homeCount = games.filter((g) => g.homeTeamId === teamId).length
      expect(homeCount).toBe(7)
    }
  })

  it('rejects an odd number of teams', () => {
    expect(() => generateSchedule('league-1', ['t1', 't2', 't3'], 4, createSeededRng(1))).toThrow()
  })

  it('rejects fewer than 2 teams', () => {
    expect(() => generateSchedule('league-1', ['t1'], 4, createSeededRng(1))).toThrow()
  })

  it('produces unplayed game shells with empty possession logs', () => {
    const games = generateSchedule('league-1', teamIds, 4, createSeededRng(1))
    expect(games.every((g) => !g.isPlayed && g.result === null && g.possessionLog.length === 0)).toBe(true)
  })

  function roundDates(games: ReturnType<typeof generateSchedule>): Date[] {
    const uniqueTimestamps = [...new Set(games.map((g) => g.date))].sort()
    return uniqueTimestamps.map((d) => new Date(d))
  }

  function gapsInDays(dates: Date[]): number[] {
    const gaps: number[] = []
    for (let i = 1; i < dates.length; i++) {
      const diffMs = dates[i].getTime() - dates[i - 1].getTime()
      gaps.push(Math.round(diffMs / (1000 * 60 * 60 * 24)))
    }
    return gaps
  }

  it('never spaces consecutive rounds more than 3 or fewer than 1 day apart, across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const games = generateSchedule('league-1', teamIds, 16, createSeededRng(seed))
      const gaps = gapsInDays(roundDates(games))
      for (const gap of gaps) {
        expect(gap).toBeGreaterThanOrEqual(1)
        expect(gap).toBeLessThanOrEqual(3)
      }
    }
  })

  it('spreads a season out over meaningfully more calendar days than seasonLength (proves rest days exist)', () => {
    const seasonLength = 16
    const games = generateSchedule('league-1', teamIds, seasonLength, createSeededRng(2))
    const dates = roundDates(games)
    const totalSpanDays = Math.round((dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24))
    expect(totalSpanDays).toBeGreaterThan(seasonLength) // old behavior: exactly seasonLength - 1
  })

  it('reaches both ends of the gap range (a back-to-back and a 3-day break) over many seeds', () => {
    let sawBackToBack = false
    let sawThreeDayGap = false
    for (let seed = 0; seed < 30; seed++) {
      const games = generateSchedule('league-1', teamIds, 16, createSeededRng(seed))
      const gaps = gapsInDays(roundDates(games))
      if (gaps.includes(1)) sawBackToBack = true
      if (gaps.includes(3)) sawThreeDayGap = true
    }
    expect(sawBackToBack).toBe(true)
    expect(sawThreeDayGap).toBe(true)
  })
})
