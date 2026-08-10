import { describe, expect, it } from 'vitest'
import type { Game, PlayerBoxScoreLine } from '../data/types'
import { comparePerformance, performanceInsights } from './performanceInsights'

const HOME = 'team-home'
const AWAY = 'team-away'

/** One box-score line carrying whatever totals a test needs; everything else is zero, since the
 *  metrics only read the fields they name. */
function line(overrides: Partial<PlayerBoxScoreLine>): PlayerBoxScoreLine {
  return {
    playerId: 'p1',
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    assists: 0,
    rebounds: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    minutesPlayed: 0,
    ...overrides,
  }
}

/** A played game from the home team's point of view, with team totals supplied directly. */
function game(
  id: string,
  own: Partial<PlayerBoxScoreLine>,
  opponent: Partial<PlayerBoxScoreLine> = {},
  scores: [number, number] = [100, 100],
): Game {
  return {
    id,
    leagueId: 'league-1',
    homeTeamId: HOME,
    awayTeamId: AWAY,
    date: new Date().toISOString(),
    isPlayed: true,
    result: {
      homeScore: scores[0],
      awayScore: scores[1],
      boxScore: { home: [line(own)], away: [line(opponent)] },
      overtimePeriods: 0,
    },
    possessionLog: [],
    isSaved: false,
  }
}

/** n games with identical totals -- the shape most of these comparisons need. */
function run(prefix: string, count: number, own: Partial<PlayerBoxScoreLine>, opponent: Partial<PlayerBoxScoreLine> = {}, scores: [number, number] = [100, 100]): Game[] {
  return Array.from({ length: count }, (_, i) => game(`${prefix}-${i}`, own, opponent, scores))
}

describe('comparePerformance', () => {
  it('says nothing until the window has enough games to mean anything', () => {
    const window = run('w', 1, { fieldGoalsMade: 60, fieldGoalsAttempted: 100 })
    const baseline = run('b', 8, { fieldGoalsMade: 40, fieldGoalsAttempted: 100 })
    expect(comparePerformance(window, baseline, [...window, ...baseline], HOME)).toEqual([])
  })

  it('reports a rise in field-goal shooting against the team own earlier season', () => {
    // 55% over the window against 45% before it -- ten points, comfortably past the threshold.
    const window = run('w', 4, { fieldGoalsMade: 55, fieldGoalsAttempted: 100 })
    const baseline = run('b', 8, { fieldGoalsMade: 45, fieldGoalsAttempted: 100 })

    const shooting = comparePerformance(window, baseline, [...window, ...baseline], HOME).find((c) => c.metricId === 'fieldGoalPct')

    expect(shooting).toBeDefined()
    expect(shooting!.basis).toBe('own-form')
    expect(shooting!.improvement).toBeCloseTo(10, 5)
    expect(shooting!.formatted.window).toBe('55.0%')
  })

  it('counts fewer turnovers as an improvement, not a decline', () => {
    // The metric falls; the team got better. Anything reading the raw delta would have this backwards.
    const window = run('w', 4, { turnovers: 8 })
    const baseline = run('b', 8, { turnovers: 14 })

    const security = comparePerformance(window, baseline, [...window, ...baseline], HOME).find((c) => c.metricId === 'turnoversPerGame')

    expect(security).toBeDefined()
    expect(security!.improvement).toBeCloseTo(6, 5)
    expect(security!.windowValue).toBeCloseTo(8, 5)
  })

  it('treats the opponent shooting better as a defensive decline', () => {
    const window = run('w', 4, {}, { fieldGoalsMade: 55, fieldGoalsAttempted: 100 })
    const baseline = run('b', 8, {}, { fieldGoalsMade: 45, fieldGoalsAttempted: 100 })

    const defence = comparePerformance(window, baseline, [...window, ...baseline], HOME).find(
      (c) => c.metricId === 'opponentFieldGoalPct',
    )

    expect(defence).toBeDefined()
    expect(defence!.side).toBe('defense')
    expect(defence!.improvement).toBeCloseTo(-10, 5)
  })

  it('falls back to the league when the team has too little season of its own', () => {
    // Two prior games is under the baseline minimum, so there is nothing to call a change in form
    // against -- but the league is always available, which is what lets an early stretch say
    // anything at all.
    const window = run('w', 4, { fieldGoalsMade: 60, fieldGoalsAttempted: 100 })
    const baseline = run('b', 2, { fieldGoalsMade: 60, fieldGoalsAttempted: 100 })
    const leagueRest = run('l', 10, { fieldGoalsMade: 40, fieldGoalsAttempted: 100 })

    const shooting = comparePerformance(window, baseline, [...window, ...baseline, ...leagueRest], HOME).find(
      (c) => c.metricId === 'fieldGoalPct',
    )

    expect(shooting).toBeDefined()
    expect(shooting!.basis).toBe('league')
    expect(shooting!.improvement).toBeGreaterThan(0)
  })

  it('ignores a swing too small to be worth a line', () => {
    const window = run('w', 4, { fieldGoalsMade: 46, fieldGoalsAttempted: 100 })
    const baseline = run('b', 8, { fieldGoalsMade: 45, fieldGoalsAttempted: 100 })

    expect(comparePerformance(window, baseline, [...window, ...baseline], HOME).some((c) => c.metricId === 'fieldGoalPct')).toBe(false)
  })

  it('refuses to call a three-point trend on too few attempts', () => {
    // 4 games x 5 attempts is 20, under the minimum -- a 100%-to-0% swing on that sample is noise,
    // and reporting it would be the fastest way to make the screen untrustworthy.
    const window = run('w', 4, { threePointersMade: 5, threePointersAttempted: 5 })
    const baseline = run('b', 8, { threePointersMade: 0, threePointersAttempted: 5 })

    expect(comparePerformance(window, baseline, [...window, ...baseline], HOME).some((c) => c.metricId === 'threePointPct')).toBe(false)
  })

  it('leads with the best news and ends with the worst', () => {
    const window = run('w', 4, { fieldGoalsMade: 60, fieldGoalsAttempted: 100, turnovers: 20 })
    const baseline = run('b', 8, { fieldGoalsMade: 45, fieldGoalsAttempted: 100, turnovers: 8 })

    const comparisons = comparePerformance(window, baseline, [...window, ...baseline], HOME)

    expect(comparisons.length).toBeGreaterThan(1)
    expect(comparisons[0].improvement).toBeGreaterThan(0)
    expect(comparisons[comparisons.length - 1].improvement).toBeLessThan(0)
  })
})

describe('performanceInsights', () => {
  it('keys on the metric and carries a tone, so recurrence can be counted per direction', () => {
    const window = run('w', 4, { fieldGoalsMade: 55, fieldGoalsAttempted: 100 })
    const baseline = run('b', 8, { fieldGoalsMade: 45, fieldGoalsAttempted: 100 })

    const insight = performanceInsights(window, baseline, [...window, ...baseline], HOME).find((i) => i.subjectId === 'fieldGoalPct')

    expect(insight).toBeDefined()
    expect(insight!.kind).toBe('performance-trend')
    expect(insight!.tone).toBe('positive')
    expect(insight!.teamId).toBe(HOME)
    expect(insight!.text).toContain('55.0%')
  })

  it('marks a decline negative', () => {
    const window = run('w', 4, { fieldGoalsMade: 40, fieldGoalsAttempted: 100 })
    const baseline = run('b', 8, { fieldGoalsMade: 50, fieldGoalsAttempted: 100 })

    const insight = performanceInsights(window, baseline, [...window, ...baseline], HOME).find((i) => i.subjectId === 'fieldGoalPct')
    expect(insight!.tone).toBe('negative')
  })

  it('ignores games the team did not play', () => {
    const ours = run('w', 4, { fieldGoalsMade: 55, fieldGoalsAttempted: 100 })
    const someoneElse: Game[] = run('other', 6, { fieldGoalsMade: 10, fieldGoalsAttempted: 100 }).map((g) => ({
      ...g,
      homeTeamId: 'team-c',
      awayTeamId: 'team-d',
    }))
    const baseline = run('b', 8, { fieldGoalsMade: 55, fieldGoalsAttempted: 100 })

    // Our own rate never moved, so nothing should be reported despite the other teams' games being
    // in the same list.
    const insights = performanceInsights(ours, [...baseline, ...someoneElse], [...ours, ...baseline, ...someoneElse], HOME)
    expect(insights.some((i) => i.subjectId === 'fieldGoalPct')).toBe(false)
  })
})
