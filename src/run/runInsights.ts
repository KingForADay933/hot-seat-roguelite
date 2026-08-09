import type { PlayerId, TeamId } from '../data/types'
import type { CoachingInsight, CoachingInsightKind } from '../engine/insights/generateCoachingInsights'
import { RUN_INSIGHTS_PER_SEASON, RUN_INSIGHT_MIN_ROUTINE_OCCURRENCES } from './constants'

/**
 * The handful of Coaching Insights worth keeping for the length of a run, so the fired epilogue can
 * say something about *how* the team kept losing rather than only that it did.
 *
 * Insights are derived from possession logs, and those are discarded as each chunk resolves (Tier
 * 1.5's payload fix) -- so anything not captured at the checkpoint is gone for good. `lastChunkInsights`
 * held them only until the next chunk overwrote it. This keeps a deliberately small, structured
 * residue instead: a few strings per season, which costs a rounding error next to the logs they came
 * from and survives to the end of the run.
 *
 * **Recurrence is what makes something notable, not kind alone.** An initial cut kept only chart
 * overrides and weak-link targeting, on the theory that a fatigue substitution is just the rotation
 * working. In practice that left the epilogue empty for most runs: weak-link insights only fire for
 * a Switch-Everything defense, and a chart override needs a chart the GM may never have authored.
 * Meanwhile the same player being hauled off exhausted in every stretch of a season *is* a
 * structural story -- a rotation too thin or minutes set too high -- it just needs to have happened
 * more than once to mean anything. So all three kinds are recorded, and routine substitutions have
 * to clear a recurrence bar before they're shown.
 */

/** Ordering when a season produced more observations than there's room for. Deliberately ahead of
 *  recurrence: a chart being overridden or a matchup being hunted always outranks rotation churn,
 *  which would otherwise crowd them out on sheer frequency. */
const KIND_PRIORITY: Record<CoachingInsightKind, number> = {
  'chart-override': 0,
  'weak-link-targeting': 1,
  'fatigue-substitution': 2,
}

/** How much of the season a kind has to span before it's worth reporting at run level. Structural
 *  problems count from the first sighting; routine rotation churn has to actually repeat. */
function minimumOccurrences(kind: CoachingInsightKind): number {
  return kind === 'fatigue-substitution' ? RUN_INSIGHT_MIN_ROUTINE_OCCURRENCES : 1
}

export interface RunInsightRecord {
  seasonNumber: number
  kind: CoachingInsightKind
  subjectId: PlayerId
  subjectName: string
  /** How many chunks of that season produced this same observation. Recurrence is the signal: the
   *  same weak link exploited in all four chunks is a season-long problem, once is a bad night. */
  occurrences: number
}

/**
 * Folds one chunk's insights into the run-long history.
 *
 * Keyed on season + kind + **subject**, deliberately not on the insight's text. The per-game prose
 * embeds specifics ("62 possessions this game, allowing 57 points") and so differs every chunk even
 * when the problem is identical -- keying on it produced three near-identical lines where the point
 * was one line saying it happened three times. The subject is what stays the same.
 *
 * Capped per season rather than overall, which bounds growth at RUN_INSIGHTS_PER_SEASON x seasons
 * played and keeps every season represented: a run's last year shouldn't crowd out the year its
 * problems started.
 */
export function recordChunkInsights(
  history: RunInsightRecord[],
  chunkInsights: CoachingInsight[],
  seasonNumber: number,
  teamId: TeamId,
): RunInsightRecord[] {
  const notable = chunkInsights.filter((insight) => insight.teamId === teamId)
  if (notable.length === 0) return history

  const merged = history.map((record) => ({ ...record }))
  for (const insight of notable) {
    const existing = merged.find(
      (record) => record.seasonNumber === seasonNumber && record.kind === insight.kind && record.subjectId === insight.subjectId,
    )
    if (existing) existing.occurrences += 1
    else
      merged.push({
        seasonNumber,
        kind: insight.kind,
        subjectId: insight.subjectId,
        subjectName: insight.subjectName,
        occurrences: 1,
      })
  }

  // Trim this season only -- earlier seasons were already trimmed when they were current, and
  // re-trimming them would let a later re-read change history that's already settled.
  const thisSeason = merged.filter((record) => record.seasonNumber === seasonNumber)
  if (thisSeason.length <= RUN_INSIGHTS_PER_SEASON) return merged

  const kept = new Set(
    [...thisSeason]
      .sort((a, b) => {
        if (KIND_PRIORITY[a.kind] !== KIND_PRIORITY[b.kind]) return KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]
        return b.occurrences - a.occurrences
      })
      .slice(0, RUN_INSIGHTS_PER_SEASON),
  )

  return merged.filter((record) => record.seasonNumber !== seasonNumber || kept.has(record))
}

export interface RunInsightSummary {
  kind: CoachingInsightKind
  subjectId: PlayerId
  subjectName: string
  /** Stretches across the whole run, not one season. */
  totalOccurrences: number
  /** Every season it showed up in, ascending. */
  seasons: number[]
}

/**
 * One line per problem for the whole run, rather than per problem per season.
 *
 * Storage stays season-scoped -- that's how recurrence is counted and capped -- but grouping the
 * *display* that way produced five near-identical blocks on a five-season run ("Andre Sinclair was
 * rotated out on fatigue, in 4 separate stretches", repeated verbatim per season). That's true and
 * completely unreadable. A problem that persisted all run is one fact, and it hits harder stated
 * once with its full weight behind it.
 *
 * Ordered by kind first, then by how often it happened, so a structural problem leads even if
 * rotation churn was more frequent.
 */
export function aggregateRunInsights(history: RunInsightRecord[]): RunInsightSummary[] {
  const reportable = history.filter((record) => record.occurrences >= minimumOccurrences(record.kind))
  const bySubject = new Map<string, RunInsightSummary>()

  for (const record of reportable) {
    const key = `${record.kind}:${record.subjectId}`
    const existing = bySubject.get(key)
    if (existing) {
      existing.totalOccurrences += record.occurrences
      if (!existing.seasons.includes(record.seasonNumber)) existing.seasons.push(record.seasonNumber)
    } else {
      bySubject.set(key, {
        kind: record.kind,
        subjectId: record.subjectId,
        subjectName: record.subjectName,
        totalOccurrences: record.occurrences,
        seasons: [record.seasonNumber],
      })
    }
  }

  return [...bySubject.values()]
    .map((summary) => ({ ...summary, seasons: [...summary.seasons].sort((a, b) => a - b) }))
    .sort((a, b) => {
      if (KIND_PRIORITY[a.kind] !== KIND_PRIORITY[b.kind]) return KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]
      return b.totalOccurrences - a.totalOccurrences
    })
}

/**
 * Run-level phrasing for one aggregated problem.
 *
 * Composed from structured fields rather than reusing the per-game text, because at this scale the
 * individual game's numbers are noise -- "62 possessions in that game" isn't the story, "hunted all
 * run" is.
 */
export function describeRunInsight(summary: RunInsightSummary): string {
  const stretches = `in ${summary.totalOccurrences} stretch${summary.totalOccurrences === 1 ? '' : 'es'}`
  const first = summary.seasons[0]
  const last = summary.seasons[summary.seasons.length - 1]
  const span = summary.seasons.length === 1 ? `in season ${first}` : `across seasons ${first}-${last}`

  switch (summary.kind) {
    case 'weak-link-targeting':
      return `${summary.subjectName} was hunted as the defensive weak link, ${stretches} ${span}.`
    case 'chart-override':
      return `${summary.subjectName} had to be pulled against your rotation chart, ${stretches} ${span}.`
    case 'fatigue-substitution':
      return `${summary.subjectName} was rotated out on fatigue, ${stretches} ${span}.`
  }
}

/**
 * Grouped by season, oldest first, each season's own records ordered most-recurrent first -- the
 * shape the epilogue reads them in.
 *
 * Applies the recurrence bar, so a season that produced nothing but one-off rotation churn drops out
 * entirely rather than padding the screen with noise.
 */
export function insightsBySeason(history: RunInsightRecord[]): { seasonNumber: number; records: RunInsightRecord[] }[] {
  const reportable = history.filter((record) => record.occurrences >= minimumOccurrences(record.kind))
  const seasons = [...new Set(reportable.map((record) => record.seasonNumber))].sort((a, b) => a - b)
  return seasons.map((seasonNumber) => ({
    seasonNumber,
    records: reportable
      .filter((record) => record.seasonNumber === seasonNumber)
      .sort((a, b) => {
        if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences
        return KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]
      }),
  }))
}
