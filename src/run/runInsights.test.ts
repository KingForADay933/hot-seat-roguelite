import { describe, expect, it } from 'vitest'
import type { CoachingInsight } from '../engine/insights/generateCoachingInsights'
import { RUN_INSIGHTS_PER_SEASON } from './constants'
import { aggregateRunInsights, describeRunInsight, insightsBySeason, recordChunkInsights, type RunInsightRecord } from './runInsights'

const TEAM = 'user-team'

const chartOverride = (subject: string, teamId = TEAM): CoachingInsight => ({ teamId, kind: 'chart-override', subjectId: subject, subjectName: subject, text: subject + ' pulled against the chart in the Q3.' })
// The text deliberately embeds a varying number, mirroring the real generator -- these must still
// merge on subject rather than fragmenting on prose.
let weakLinkCall = 0
const weakLink = (subject: string, teamId = TEAM): CoachingInsight => ({ teamId, kind: 'weak-link-targeting', subjectId: subject, subjectName: subject, text: subject + ' matched up on ' + ++weakLinkCall + ' possessions this game.' })
const routineSub = (subject: string, teamId = TEAM): CoachingInsight => ({ teamId, kind: 'fatigue-substitution', subjectId: subject, subjectName: subject, text: subject + ' pulled tired.' })

describe('recordChunkInsights', () => {
  it('records every kind, including routine substitutions', () => {
    // Recording is deliberately permissive -- the recurrence bar is applied at display time
    // (insightsBySeason), so a routine sub that goes on to repeat can still earn its place.
    const history = recordChunkInsights([], [chartOverride('chart lost'), weakLink('picked on'), routineSub('routine')], 1, TEAM)

    expect(history).toHaveLength(3)
    expect(history.map((r) => r.kind).sort()).toEqual(['chart-override', 'fatigue-substitution', 'weak-link-targeting'])
    expect(history.every((r) => r.occurrences === 1)).toBe(true)
    expect(history.every((r) => r.seasonNumber === 1)).toBe(true)
  })

  it('ignores insights about the opponent', () => {
    const history = recordChunkInsights([], [weakLink('their problem', 'other-team')], 1, TEAM)
    expect(history).toEqual([])
  })

  it('counts a repeat across chunks rather than duplicating it', () => {
    let history = recordChunkInsights([], [weakLink('same hole')], 1, TEAM)
    history = recordChunkInsights(history, [weakLink('same hole')], 1, TEAM)
    history = recordChunkInsights(history, [weakLink('same hole')], 1, TEAM)

    expect(history).toHaveLength(1)
    expect(history[0].occurrences).toBe(3)
  })

  it('treats the same text in a different season as its own record', () => {
    let history = recordChunkInsights([], [weakLink('same hole')], 1, TEAM)
    history = recordChunkInsights(history, [weakLink('same hole')], 2, TEAM)

    expect(history).toHaveLength(2)
    expect(history.map((r) => r.seasonNumber)).toEqual([1, 2])
    expect(history.every((r) => r.occurrences === 1)).toBe(true)
  })

  it('caps a season, keeping the most recurrent', () => {
    // Four distinct problems in one season, one of which recurs.
    let history = recordChunkInsights([], [weakLink('recurs'), weakLink('a'), weakLink('b'), weakLink('c')], 1, TEAM)
    history = recordChunkInsights(history, [weakLink('recurs')], 1, TEAM)

    expect(history).toHaveLength(RUN_INSIGHTS_PER_SEASON)
    expect(history.find((r) => r.subjectName === 'recurs')?.occurrences).toBe(2)
  })

  it('breaks a cap tie toward the chart override -- an instruction failing outranks a matchup', () => {
    const history = recordChunkInsights(
      [],
      [weakLink('w1'), weakLink('w2'), weakLink('w3'), chartOverride('chart lost')],
      1,
      TEAM,
    )

    expect(history).toHaveLength(RUN_INSIGHTS_PER_SEASON)
    expect(history.some((r) => r.kind === 'chart-override')).toBe(true)
  })

  it('does not re-trim earlier seasons when a later one is recorded', () => {
    // A season at its cap stays at its cap; recording season 2 must not disturb it.
    let history = recordChunkInsights([], [weakLink('a'), weakLink('b'), weakLink('c')], 1, TEAM)
    const seasonOneBefore = history.filter((r) => r.seasonNumber === 1).length
    history = recordChunkInsights(history, [weakLink('later')], 2, TEAM)

    expect(history.filter((r) => r.seasonNumber === 1)).toHaveLength(seasonOneBefore)
    expect(history.filter((r) => r.seasonNumber === 2)).toHaveLength(1)
  })

  it('returns the history untouched when a chunk produced nothing for this team', () => {
    const history: RunInsightRecord[] = [{ seasonNumber: 1, kind: 'weak-link-targeting', subjectId: 'x', subjectName: 'x', occurrences: 1 }]
    expect(recordChunkInsights(history, [routineSub('routine', 'other-team')], 2, TEAM)).toBe(history)
    expect(recordChunkInsights(history, [], 2, TEAM)).toBe(history)
  })

  it('never lets rotation churn crowd a structural problem out of a capped season', () => {
    // Four routine subs, each recurring, plus one weak link seen once. Sorting on recurrence alone
    // would drop the weak link; kind priority is checked first precisely so it can't.
    let history = recordChunkInsights([], [routineSub('r1'), routineSub('r2'), routineSub('r3'), routineSub('r4')], 1, TEAM)
    history = recordChunkInsights(history, [routineSub('r1'), routineSub('r2'), routineSub('r3'), routineSub('r4')], 1, TEAM)
    history = recordChunkInsights(history, [weakLink('the real problem')], 1, TEAM)

    expect(history).toHaveLength(RUN_INSIGHTS_PER_SEASON)
    expect(history.some((r) => r.kind === 'weak-link-targeting')).toBe(true)
  })

  it('does not mutate the history it is given', () => {
    const history = recordChunkInsights([], [weakLink('same hole')], 1, TEAM)
    const snapshot = JSON.parse(JSON.stringify(history))
    recordChunkInsights(history, [weakLink('same hole')], 1, TEAM)
    expect(history).toEqual(snapshot)
  })
})

describe('insightsBySeason', () => {
  it('groups oldest season first, most recurrent within each', () => {
    let history = recordChunkInsights([], [weakLink('once')], 1, TEAM)
    history = recordChunkInsights(history, [weakLink('twice')], 1, TEAM)
    history = recordChunkInsights(history, [weakLink('twice')], 1, TEAM)
    history = recordChunkInsights(history, [chartOverride('season two')], 2, TEAM)

    const grouped = insightsBySeason(history)

    expect(grouped.map((g) => g.seasonNumber)).toEqual([1, 2])
    expect(grouped[0].records.map((r) => r.subjectName)).toEqual(['twice', 'once'])
    expect(grouped[1].records).toHaveLength(1)
  })

  it('is empty for an empty history', () => {
    expect(insightsBySeason([])).toEqual([])
  })
})

describe('the recurrence bar', () => {
  it('hides a one-off routine substitution but keeps one that repeats', () => {
    const once = recordChunkInsights([], [routineSub('tired once')], 1, TEAM)
    expect(insightsBySeason(once)).toEqual([])

    const twice = recordChunkInsights(once, [routineSub('tired once')], 1, TEAM)
    const grouped = insightsBySeason(twice)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].records[0].occurrences).toBe(2)
  })

  it('reports a structural problem from its first sighting', () => {
    expect(insightsBySeason(recordChunkInsights([], [weakLink('hunted')], 1, TEAM))).toHaveLength(1)
    expect(insightsBySeason(recordChunkInsights([], [chartOverride('overruled')], 1, TEAM))).toHaveLength(1)
  })
})

describe('aggregateRunInsights + describeRunInsight', () => {
  it('states a run-long problem once, with its full weight, not once per season', () => {
    // The same problem in three seasons used to render as three near-identical lines.
    let history = recordChunkInsights([], [weakLink('Devon Fenwick')], 1, TEAM)
    history = recordChunkInsights(history, [weakLink('Devon Fenwick')], 1, TEAM)
    history = recordChunkInsights(history, [weakLink('Devon Fenwick')], 2, TEAM)
    history = recordChunkInsights(history, [weakLink('Devon Fenwick')], 3, TEAM)

    const summaries = aggregateRunInsights(history)
    expect(summaries).toHaveLength(1)
    expect(summaries[0].totalOccurrences).toBe(4)
    expect(summaries[0].seasons).toEqual([1, 2, 3])
    expect(describeRunInsight(summaries[0])).toBe(
      'Devon Fenwick was hunted as the defensive weak link, in 4 stretches across seasons 1-3.',
    )
    // The per-game text embedded a possession count; the run-level line must not.
    expect(describeRunInsight(summaries[0])).not.toMatch(/possessions/)
  })

  it('names a single season rather than a span when that is all there was', () => {
    const [summary] = aggregateRunInsights(recordChunkInsights([], [chartOverride('Jalen Ruiz')], 4, TEAM))
    expect(describeRunInsight(summary)).toBe('Jalen Ruiz had to be pulled against your rotation chart, in 1 stretch in season 4.')
  })

  it('leads with the structural problem even when churn was more frequent', () => {
    let history = recordChunkInsights([], [routineSub('gassed')], 1, TEAM)
    history = recordChunkInsights(history, [routineSub('gassed')], 1, TEAM)
    history = recordChunkInsights(history, [routineSub('gassed')], 2, TEAM)
    history = recordChunkInsights(history, [routineSub('gassed')], 2, TEAM)
    history = recordChunkInsights(history, [weakLink('hunted')], 2, TEAM)

    const summaries = aggregateRunInsights(history)
    expect(summaries[0].kind).toBe('weak-link-targeting')
    expect(summaries[1].kind).toBe('fatigue-substitution')
    expect(summaries[1].totalOccurrences).toBe(4)
  })

  it('drops a one-off routine sub entirely', () => {
    expect(aggregateRunInsights(recordChunkInsights([], [routineSub('once')], 1, TEAM))).toEqual([])
  })
})

describe('performance trends across a season', () => {
  const trend = (metric: string, tone: 'positive' | 'negative'): CoachingInsight => ({
    teamId: TEAM,
    kind: 'performance-trend',
    subjectId: metric,
    subjectName: metric === 'threePointPct' ? 'three-point shooting' : 'points allowed',
    tone,
    text: `${metric} moved`,
  })

  it('counts a trend that recurs across the season stretches', () => {
    let history: RunInsightRecord[] = []
    for (let chunk = 0; chunk < 3; chunk++) {
      history = recordChunkInsights(history, [trend('threePointPct', 'negative')], 1, TEAM)
    }

    const summary = aggregateRunInsights(history).find((s) => s.subjectId === 'threePointPct')
    expect(summary).toBeDefined()
    expect(summary!.totalOccurrences).toBe(3)
    expect(summary!.tone).toBe('negative')
    expect(describeRunInsight(summary!)).toContain('a problem')
  })

  it('keeps a metric that swung both ways as two separate facts', () => {
    // A team that shot well in two stretches and badly in two others has two things worth saying.
    // Merging them would report four occurrences of a trend with no direction at all.
    let history: RunInsightRecord[] = []
    history = recordChunkInsights(history, [trend('threePointPct', 'positive')], 1, TEAM)
    history = recordChunkInsights(history, [trend('threePointPct', 'positive')], 1, TEAM)
    history = recordChunkInsights(history, [trend('threePointPct', 'negative')], 1, TEAM)
    history = recordChunkInsights(history, [trend('threePointPct', 'negative')], 1, TEAM)

    const summaries = aggregateRunInsights(history).filter((s) => s.subjectId === 'threePointPct')
    expect(summaries).toHaveLength(2)
    expect(summaries.map((s) => s.tone).sort()).toEqual(['negative', 'positive'])
    expect(summaries.every((s) => s.totalOccurrences === 2)).toBe(true)
  })

  it('does not report a one-off swing as a season pattern', () => {
    const history = recordChunkInsights([], [trend('threePointPct', 'positive')], 1, TEAM)
    expect(aggregateRunInsights(history).some((s) => s.subjectId === 'threePointPct')).toBe(false)
  })

  it('describes a recurring strength as a strength', () => {
    let history: RunInsightRecord[] = []
    history = recordChunkInsights(history, [trend('threePointPct', 'positive')], 1, TEAM)
    history = recordChunkInsights(history, [trend('threePointPct', 'positive')], 1, TEAM)

    const summary = aggregateRunInsights(history).find((s) => s.subjectId === 'threePointPct')!
    expect(describeRunInsight(summary)).toContain('a strength')
    expect(describeRunInsight(summary)).toContain('Three-point shooting')
  })
})
