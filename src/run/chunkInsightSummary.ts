import type { CoachingInsight } from '../engine/insights/generateCoachingInsights'

/**
 * One line per problem at a checkpoint, rather than one line per problem per game.
 *
 * A chunk spans several games and `generateCoachingInsights` runs on each of them, so a standing
 * problem -- the same defender hunted every night -- produced a bullet every single game. The
 * checkpoint this feeds is the screen the GM sees most often, and twelve bullets that are really
 * two observations read as noise: the two genuinely distinct events get buried under eight
 * restatements of the same one, and the screen trains you to skip it.
 *
 * This replaces an earlier dedupe that compared the insight **text**, which could never have worked:
 * the prose embeds per-game specifics ("33 possessions this game, allowing 34 points") and so
 * differs every game even when the underlying problem is identical. That is the same trap
 * run/runInsights.ts already hit and fixed at the run level -- the fix is the same, key on kind plus
 * subject, which is what actually stays the same.
 *
 * **Collapsing here also repairs the run-level counts.** `recordChunkInsights` increments a
 * subject's `occurrences` once per insight it is handed, and its records document that count as
 * "how many chunks of that season produced this observation" -- which only holds if a chunk hands it
 * one entry per problem. Feeding it the raw per-game list meant a four-chunk season could report
 * "in 23 stretches", and the epilogue inherited the exaggeration.
 *
 * Idempotent: re-running over an already-summarised list finds every group at size one and returns
 * the entries untouched, so it is safe to apply again at display time for saves written before this
 * existed.
 */

/** Groups keep first-seen order so the checkpoint still reads in the order the stretch played out. */
function groupKey(insight: CoachingInsight): string {
  return `${insight.kind}:${insight.subjectId}`
}

function sumMetrics(group: CoachingInsight[]): { possessionsTargeted: number; pointsAllowed: number } | undefined {
  const withMetrics = group.filter((insight) => insight.metrics !== undefined)
  if (withMetrics.length === 0) return undefined
  return {
    possessionsTargeted: withMetrics.reduce((sum, insight) => sum + (insight.metrics?.possessionsTargeted ?? 0), 0),
    pointsAllowed: withMetrics.reduce((sum, insight) => sum + (insight.metrics?.pointsAllowed ?? 0), 0),
  }
}

/**
 * Prose for a problem that showed up in several of the stretch's games.
 *
 * Deliberately drops the per-game numbers in favour of the totals: at this scale "36 possessions in
 * that one game" isn't the story, "191 possessions across five games" is. Written from the
 * structured fields rather than by editing the single-game text, for the same reason the run-level
 * phrasing is.
 */
function describeRepeat(group: CoachingInsight[], defensiveSchemeName: string | undefined): string {
  const first = group[0]
  const games = `${group.length} of this stretch's games`
  const metrics = sumMetrics(group)

  switch (first.kind) {
    case 'weak-link-targeting': {
      const scheme = defensiveSchemeName ?? 'Your defense'
      const evidence = metrics ? ` -- ${metrics.possessionsTargeted} possessions, ${metrics.pointsAllowed} points allowed` : ''
      return `${scheme} kept getting picked on: ${first.subjectName} was the target in ${games}${evidence}.`
    }
    case 'chart-override':
      return `${first.subjectName} had to be pulled against your rotation chart in ${games}.`
    case 'fatigue-substitution':
      return `${first.subjectName} was pulled with heavy fatigue in ${games}.`
  }
}

/**
 * `defensiveSchemeName` names the scheme being exploited in the collapsed weak-link line -- the
 * single-game text carries it inline, but the summary is rebuilt from structured fields, and the
 * scheme is exactly the thing the GM would change in response.
 */
export function summarizeChunkInsights(insights: CoachingInsight[], defensiveSchemeName?: string): CoachingInsight[] {
  const groups = new Map<string, CoachingInsight[]>()
  for (const insight of insights) {
    const key = groupKey(insight)
    const existing = groups.get(key)
    if (existing) existing.push(insight)
    else groups.set(key, [insight])
  }

  return [...groups.values()].map((group) => {
    // A one-off keeps its original text: the specifics are genuinely informative when there is only
    // one game's worth of them, and rewriting "in 1 of this stretch's games" would say less.
    if (group.length === 1) return group[0]
    return { ...group[0], metrics: sumMetrics(group), text: describeRepeat(group, defensiveSchemeName) }
  })
}
