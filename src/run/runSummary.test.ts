import { describe, expect, it } from 'vitest'
import type { League, StandingsRow } from '../data/types'
import { buildRunSummary } from './runSummary'
import { createRun } from './runState'
import { evaluateSeasonEnd } from './runState'
import type { RunState } from './types'

const TEAM = 'user-team'

/**
 * Standings for one season, best-to-worst (computeStandings' contract), with the run's team placed
 * at `rank`. Eight teams, so a 0.5 target cuts at 4th and a 0.4 target at 4th too (ceil(8 * 0.4)).
 */
function standingsWithUserAt(rank: number, wins: number): StandingsRow[] {
  const rows: StandingsRow[] = []
  for (let i = 1; i <= 8; i++) {
    // Descending win totals so the ordering is genuinely best-to-worst; the user's own row is
    // overridden to the requested win count.
    const isUser = i === rank
    const w = isUser ? wins : 40 - i * 2
    rows.push({
      teamId: isUser ? TEAM : `team-${i}`,
      wins: w,
      losses: 32 - w,
      winPct: w / 32,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: isUser ? -5 : 0,
    })
  }
  return rows
}

function leagueWith(seasons: { rank: number; wins: number }[]): League {
  return {
    id: 'league-1',
    name: 'L',
    structure: 'single-conference',
    teamIds: [],
    scheduleGameIds: [],
    rules: { seasonLength: 32, playoffFormat: null },
    pacePresets: { possessionsPerGame: 200 },
    currentDate: '',
    userControlledTeamId: TEAM,
    seasonNumber: seasons.length + 1,
    seasonHistory: seasons.map((s, i) => ({ seasonNumber: i + 1, standings: standingsWithUserAt(s.rank, s.wins) })),
  }
}

function runAfter(seasons: { rank: number; wins: number }[]): RunState {
  // Drives the real state machine over the same standings, so the fixture's run state is whatever
  // evaluateSeasonEnd would actually have produced rather than something hand-set.
  let run = createRun(TEAM, 'stacked-guards', 'youth-movement', 'mid')
  for (const season of seasons) {
    run = evaluateSeasonEnd(run, standingsWithUserAt(season.rank, season.wins))
  }
  return run
}

describe('buildRunSummary', () => {
  it('is empty for a run with no completed seasons', () => {
    const summary = buildRunSummary(runAfter([]), leagueWith([]))
    expect(summary.seasons).toEqual([])
    expect(summary.bestSeason).toBeNull()
    expect(summary.closestMiss).toBeNull()
    expect(summary.firedIn).toBeNull()
  })

  it('reconstructs which stretch each season belonged to, and the bar at the time', () => {
    // Clear the first stretch immediately, then miss twice in the second.
    const seasons = [
      { rank: 2, wins: 20 },
      { rank: 6, wins: 12 },
      { rank: 5, wins: 14 },
    ]
    const summary = buildRunSummary(runAfter(seasons), leagueWith(seasons))

    expect(summary.seasons.map((s) => s.stretchNumber)).toEqual([1, 2, 2])
    expect(summary.seasons.map((s) => s.seasonInStretch)).toEqual([1, 1, 2])
    // Stretch 1 asks for the top half of 8 (4th); stretch 2 tightens by 10 points to 0.4, which
    // still resolves to 4th at this league size but is a genuinely different fraction.
    expect(summary.seasons[0].targetRankFraction).toBeCloseTo(0.5, 5)
    expect(summary.seasons[1].targetRankFraction).toBeCloseTo(0.4, 5)
    expect(summary.seasons.map((s) => s.hitTarget)).toEqual([true, false, false])
  })

  it('reports how many wins short a missed season was, and zero for one that hit', () => {
    // 4th place is the cutoff at a 0.5 target; that team has 40 - 4*2 = 32 wins in this fixture.
    const seasons = [{ rank: 6, wins: 25 }]
    const summary = buildRunSummary(runAfter(seasons), leagueWith(seasons))

    expect(summary.seasons[0].hitTarget).toBe(false)
    expect(summary.seasons[0].targetRank).toBe(4)
    expect(summary.seasons[0].winsShort).toBe(32 - 25)

    const hit = buildRunSummary(runAfter([{ rank: 1, wins: 30 }]), leagueWith([{ rank: 1, wins: 30 }]))
    expect(hit.seasons[0].winsShort).toBe(0)
  })

  it('picks the closest miss across the whole run, not the last one', () => {
    const seasons = [
      { rank: 5, wins: 31 }, // 1 win short
      { rank: 7, wins: 10 }, // 22 short
    ]
    const summary = buildRunSummary(runAfter(seasons), leagueWith(seasons))

    expect(summary.closestMiss?.seasonNumber).toBe(1)
    expect(summary.closestMiss?.winsShort).toBe(1)
  })

  it('picks the best season by finish, breaking ties on wins', () => {
    const seasons = [
      { rank: 3, wins: 18 },
      { rank: 3, wins: 24 },
      { rank: 7, wins: 8 },
    ]
    const summary = buildRunSummary(runAfter(seasons), leagueWith(seasons))

    expect(summary.bestSeason?.seasonNumber).toBe(2)
    expect(summary.bestSeason?.rank).toBe(3)
  })

  it('names the season that ended the run, once the run is actually fired', () => {
    // Mid market gives three seasons a stretch, so three straight misses is a firing.
    const seasons = [
      { rank: 6, wins: 12 },
      { rank: 7, wins: 10 },
      { rank: 8, wins: 6 },
    ]
    const run = runAfter(seasons)
    expect(run.status).toBe('fired')

    const summary = buildRunSummary(run, leagueWith(seasons))
    expect(summary.firedIn?.seasonNumber).toBe(3)
    expect(summary.stretchesCleared).toBe(0)
  })

  it('leaves firedIn null while the run is still alive', () => {
    const seasons = [{ rank: 6, wins: 12 }]
    const run = runAfter(seasons)
    expect(run.status).toBe('active')
    expect(buildRunSummary(run, leagueWith(seasons)).firedIn).toBeNull()
  })

  it('counts stretches cleared and totals the whole run s record', () => {
    const seasons = [
      { rank: 1, wins: 24 },
      { rank: 2, wins: 20 },
    ]
    const summary = buildRunSummary(runAfter(seasons), leagueWith(seasons))

    expect(summary.stretchesCleared).toBe(2) // both seasons cleared, so the run is on stretch 3
    expect(summary.totalWins).toBe(44)
    expect(summary.totalLosses).toBe(64 - 44)
  })

  it('skips a season whose standings are missing the run team rather than throwing', () => {
    const league = leagueWith([{ rank: 3, wins: 20 }])
    league.seasonHistory[0].standings = league.seasonHistory[0].standings.map((row) => ({ ...row, teamId: 'someone-else' }))

    expect(() => buildRunSummary(runAfter([]), league)).not.toThrow()
    expect(buildRunSummary(runAfter([]), league).seasons).toEqual([])
  })
})
