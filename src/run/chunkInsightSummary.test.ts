import { describe, expect, it } from 'vitest'
import type { CoachingInsight } from '../engine/insights/generateCoachingInsights'
import { summarizeChunkInsights } from './chunkInsightSummary'

function weakLink(subjectId: string, possessions: number, points: number): CoachingInsight {
  return {
    teamId: 'team-1',
    kind: 'weak-link-targeting',
    subjectId,
    subjectName: subjectId === 'p1' ? 'Devon Whitfield' : 'Rashad Ambrose',
    metrics: { possessionsTargeted: possessions, pointsAllowed: points },
    // The per-game numbers are baked into the prose, which is exactly why text can't be the key.
    text: `Switch-Everything defense got picked on: ${subjectId} was matched up on ${possessions} possessions this game, allowing ${points} points.`,
  }
}

function fatigueSub(subjectId: string, period: string): CoachingInsight {
  return {
    teamId: 'team-1',
    kind: 'fatigue-substitution',
    subjectId,
    subjectName: 'Rashad Okafor',
    text: `Rashad Okafor was pulled with heavy fatigue in the ${period}, someone checked in.`,
  }
}

describe('summarizeChunkInsights', () => {
  it('collapses one problem repeated across a stretch into a single line', () => {
    const stretch = [weakLink('p1', 36, 36), weakLink('p1', 41, 59), weakLink('p1', 38, 41), weakLink('p1', 40, 46)]
    const result = summarizeChunkInsights(stretch, 'Switch-Everything')

    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('4 of this stretch')
    // Totals, not one game's numbers: 36+41+38+40 possessions and 36+59+41+46 points.
    expect(result[0].text).toContain('155 possessions')
    expect(result[0].text).toContain('182 points')
    expect(result[0].metrics).toEqual({ possessionsTargeted: 155, pointsAllowed: 182 })
  })

  it('keeps different subjects apart', () => {
    const result = summarizeChunkInsights([weakLink('p1', 36, 36), weakLink('p2', 33, 30), weakLink('p1', 41, 59)], 'Switch-Everything')

    expect(result).toHaveLength(2)
    expect(result.find((i) => i.subjectId === 'p1')!.text).toContain('2 of this stretch')
    // A single sighting keeps its original, more specific per-game wording.
    expect(result.find((i) => i.subjectId === 'p2')!.text).toContain('this game')
  })

  it('keeps different kinds about the same player apart', () => {
    const sameGuy: CoachingInsight[] = [weakLink('p1', 36, 36), weakLink('p1', 30, 30), fatigueSub('p1', 'Q4'), fatigueSub('p1', 'Q3')]
    const result = summarizeChunkInsights(sameGuy, 'Switch-Everything')

    expect(result).toHaveLength(2)
    expect(result.map((i) => i.kind).sort()).toEqual(['fatigue-substitution', 'weak-link-targeting'])
  })

  it('names the scheme being exploited, and falls back when it is unknown', () => {
    const repeated = [weakLink('p1', 36, 36), weakLink('p1', 30, 30)]
    expect(summarizeChunkInsights(repeated, 'Pack-the-Paint')[0].text).toContain('Pack-the-Paint')
    expect(summarizeChunkInsights(repeated)[0].text).toContain('Your defense')
  })

  it('summarises a repeated fatigue substitution by count alone -- it is an event, not a measurement', () => {
    const result = summarizeChunkInsights([fatigueSub('p3', 'Q2'), fatigueSub('p3', 'Q4'), fatigueSub('p3', 'Q4')])

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe("Rashad Okafor was pulled with heavy fatigue in 3 of this stretch's games.")
  })

  it('leaves a one-off entirely alone', () => {
    const one = [weakLink('p1', 36, 36)]
    expect(summarizeChunkInsights(one, 'Switch-Everything')).toEqual(one)
  })

  it('is idempotent, so applying it again at display time is safe', () => {
    const stretch = [weakLink('p1', 36, 36), weakLink('p1', 41, 59), fatigueSub('p3', 'Q4')]
    const once = summarizeChunkInsights(stretch, 'Switch-Everything')
    const twice = summarizeChunkInsights(once, 'Switch-Everything')

    expect(twice).toEqual(once)
  })

  it('handles insights saved before metrics existed by dropping the numeric clause', () => {
    const withoutMetrics = [weakLink('p1', 36, 36), weakLink('p1', 41, 59)].map(({ metrics: _metrics, ...rest }) => rest)
    const result = summarizeChunkInsights(withoutMetrics, 'Switch-Everything')

    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('2 of this stretch')
    expect(result[0].text).not.toContain('possessions,')
    expect(result[0].metrics).toBeUndefined()
  })

  it('preserves the order problems first appeared in', () => {
    const result = summarizeChunkInsights([fatigueSub('p3', 'Q1'), weakLink('p1', 36, 36), fatigueSub('p3', 'Q4')])
    expect(result.map((i) => i.subjectId)).toEqual(['p3', 'p1'])
  })
})
