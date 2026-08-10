import type { Game, TeamId } from '../data/types'
import type { CoachingInsight } from '../engine/insights/generateCoachingInsights'
import { PERFORMANCE_INSIGHT_MIN_BASELINE_GAMES, PERFORMANCE_INSIGHT_MIN_WINDOW_GAMES } from './constants'
import { teamGameStats, teamStatsForGames, type TeamGameStats } from './teamGameStats'

/**
 * What a stretch of games says about how the team is actually playing, as opposed to what happened
 * to individual players in them.
 *
 * The existing insights (engine/insights/generateCoachingInsights.ts) are all *events* reconstructed
 * from one game's possession log: someone was hunted, someone was pulled. They only speak when
 * something goes wrong, and two of the three need specific conditions -- a Switch-Everything defence,
 * or a rotation chart the GM may never have authored -- so a typical run heard nothing at all from
 * them. These are *rates*, computed over a window of games and compared against something, which is
 * what lets the game say a stretch went well rather than only that it went badly.
 *
 * Everything here derives from `game.result.boxScore`, which is permanent, so a window can be
 * recomputed at any time from `bundle.games`. Nothing new is persisted and the numbers can never
 * drift from the games they describe.
 */

/** Counting stats summed over a set of games, which every rate below is computed from. */
interface StatWindow {
  games: number
  points: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  rebounds: number
  turnovers: number
  opponentPoints: number
  opponentFieldGoalsMade: number
  opponentFieldGoalsAttempted: number
  opponentRebounds: number
  opponentTurnovers: number
}

function emptyWindow(): StatWindow {
  return {
    games: 0,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    rebounds: 0,
    turnovers: 0,
    opponentPoints: 0,
    opponentFieldGoalsMade: 0,
    opponentFieldGoalsAttempted: 0,
    opponentRebounds: 0,
    opponentTurnovers: 0,
  }
}

function windowOf(stats: TeamGameStats[]): StatWindow {
  return stats.reduce<StatWindow>((acc, s) => {
    acc.games += 1
    acc.points += s.points
    acc.fieldGoalsMade += s.fieldGoalsMade
    acc.fieldGoalsAttempted += s.fieldGoalsAttempted
    acc.threePointersMade += s.threePointersMade
    acc.threePointersAttempted += s.threePointersAttempted
    acc.rebounds += s.rebounds
    acc.turnovers += s.turnovers
    acc.opponentPoints += s.opponentPoints
    acc.opponentFieldGoalsMade += s.opponentFieldGoalsMade
    acc.opponentFieldGoalsAttempted += s.opponentFieldGoalsAttempted
    acc.opponentRebounds += s.opponentRebounds
    acc.opponentTurnovers += s.opponentTurnovers
    return acc
  }, emptyWindow())
}

/**
 * The league's own rates, for a team with too little history to be compared against itself.
 *
 * Built by counting *both* sides of every played game, which makes the "opponent" totals identical
 * to the team totals -- correct rather than a shortcut, since the league as a whole is its own
 * opposition. It means a defensive metric compares against the same league-average shooting an
 * offensive one does, which is exactly the right yardstick.
 */
function leagueWindow(games: Game[]): StatWindow {
  const window = emptyWindow()
  for (const game of games) {
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      const stats = teamGameStats(game, teamId)
      if (!stats) continue
      const single = windowOf([stats])
      window.games += 1
      window.points += single.points
      window.fieldGoalsMade += single.fieldGoalsMade
      window.fieldGoalsAttempted += single.fieldGoalsAttempted
      window.threePointersMade += single.threePointersMade
      window.threePointersAttempted += single.threePointersAttempted
      window.rebounds += single.rebounds
      window.turnovers += single.turnovers
      window.opponentPoints += single.opponentPoints
      window.opponentFieldGoalsMade += single.opponentFieldGoalsMade
      window.opponentFieldGoalsAttempted += single.opponentFieldGoalsAttempted
      window.opponentRebounds += single.opponentRebounds
      window.opponentTurnovers += single.opponentTurnovers
    }
  }
  return window
}

export type InsightSide = 'offense' | 'defense'

interface TeamMetric {
  id: string
  /** Names the thing being measured, phrased to sit inside a sentence. */
  label: string
  side: InsightSide
  /** False for turnovers and anything measured against the opponent, where down is good. */
  higherIsBetter: boolean
  /** Null when the window can't support the rate -- too few attempts to mean anything. */
  value: (w: StatWindow) => number | null
  format: (value: number) => string
  /** How a *difference* in this metric reads, which is not how the value itself reads: the gap
   *  between 43.5% and 38.8% is 4.7 percentage points, and calling it "4.7%" means something else
   *  entirely to anyone who reads box scores. */
  formatDelta: (value: number) => string
  /** How far the window has to move, in the metric's own units, before it is worth a line. */
  threshold: number
}

/** A rate needs enough attempts behind it before a swing means anything rather than being noise --
 *  three games of cold three-point shooting is twelve missed shots, not a trend. */
const MIN_FIELD_GOAL_ATTEMPTS = 120
const MIN_THREE_POINT_ATTEMPTS = 45

const percent = (made: number, attempted: number, floor: number): number | null =>
  attempted < floor ? null : (made / attempted) * 100
const perGame = (total: number, games: number): number | null => (games === 0 ? null : total / games)
const asPercent = (v: number) => `${v.toFixed(1)}%`
const asPercentagePoints = (v: number) => `${v.toFixed(1)} point${v.toFixed(1) === '1.0' ? '' : 's'}`
const asPerGame = (v: number) => v.toFixed(1)

/**
 * The metrics worth commenting on, in the order they're reported when several move at once.
 *
 * Ordered offense-then-defense and headline-first inside each, so a stretch that moved on several
 * fronts leads with shooting rather than with rebounds. Thresholds are in each metric's own units
 * and set wide enough that an ordinary hot or cold week doesn't trip them.
 */
const METRICS: TeamMetric[] = [
  {
    id: 'fieldGoalPct',
    label: 'shooting from the field',
    side: 'offense',
    higherIsBetter: true,
    value: (w) => percent(w.fieldGoalsMade, w.fieldGoalsAttempted, MIN_FIELD_GOAL_ATTEMPTS),
    format: asPercent,
    formatDelta: asPercentagePoints,
    threshold: 2.5,
  },
  {
    id: 'threePointPct',
    label: 'three-point shooting',
    side: 'offense',
    higherIsBetter: true,
    value: (w) => percent(w.threePointersMade, w.threePointersAttempted, MIN_THREE_POINT_ATTEMPTS),
    format: asPercent,
    formatDelta: asPercentagePoints,
    threshold: 4,
  },
  {
    id: 'pointsPerGame',
    label: 'scoring',
    side: 'offense',
    higherIsBetter: true,
    value: (w) => perGame(w.points, w.games),
    format: asPerGame,
    formatDelta: asPerGame,
    threshold: 5,
  },
  {
    id: 'turnoversPerGame',
    label: 'ball security',
    side: 'offense',
    higherIsBetter: false,
    value: (w) => perGame(w.turnovers, w.games),
    format: asPerGame,
    formatDelta: asPerGame,
    threshold: 2,
  },
  {
    id: 'opponentFieldGoalPct',
    label: 'the shooting you allowed',
    side: 'defense',
    higherIsBetter: false,
    value: (w) => percent(w.opponentFieldGoalsMade, w.opponentFieldGoalsAttempted, MIN_FIELD_GOAL_ATTEMPTS),
    format: asPercent,
    formatDelta: asPercentagePoints,
    threshold: 2.5,
  },
  {
    id: 'opponentPointsPerGame',
    label: 'points allowed',
    side: 'defense',
    higherIsBetter: false,
    value: (w) => perGame(w.opponentPoints, w.games),
    format: asPerGame,
    formatDelta: asPerGame,
    threshold: 5,
  },
  {
    id: 'forcedTurnoversPerGame',
    label: 'turnovers forced',
    side: 'defense',
    higherIsBetter: true,
    value: (w) => perGame(w.opponentTurnovers, w.games),
    format: asPerGame,
    formatDelta: asPerGame,
    threshold: 2,
  },
  {
    id: 'reboundsPerGame',
    label: 'rebounding',
    side: 'defense',
    higherIsBetter: true,
    value: (w) => perGame(w.rebounds, w.games),
    format: asPerGame,
    formatDelta: asPerGame,
    threshold: 4,
  },
]

/** What the window was measured against, which changes what the sentence can claim. */
export type ComparisonBasis =
  /** The team's own earlier games this season -- a genuine change in form. */
  | 'own-form'
  /** The league, because there isn't enough of the team's own season yet to compare against. */
  | 'league'

export interface PerformanceComparison {
  metricId: string
  label: string
  side: InsightSide
  basis: ComparisonBasis
  windowValue: number
  referenceValue: number
  /** Signed so positive always means *better*, whichever direction the raw metric runs. */
  improvement: number
  formatted: { window: string; reference: string; improvement: string }
}

/**
 * Every metric that moved far enough to be worth a line, best news first.
 *
 * Compared against the team's own earlier season once there is enough of one, and against the league
 * before that -- which is what lets the very first checkpoint of a run say something instead of
 * waiting for a baseline to accumulate. Only one comparison is ever made per metric, so a stretch
 * can't report the same thing twice under two headings.
 */
export function comparePerformance(
  windowGames: Game[],
  baselineGames: Game[],
  leagueGames: Game[],
  teamId: TeamId,
): PerformanceComparison[] {
  const window = windowOf(teamStatsForGames(windowGames, teamId))
  if (window.games < PERFORMANCE_INSIGHT_MIN_WINDOW_GAMES) return []

  const ownBaseline = windowOf(teamStatsForGames(baselineGames, teamId))
  const useOwnForm = ownBaseline.games >= PERFORMANCE_INSIGHT_MIN_BASELINE_GAMES
  const reference = useOwnForm ? ownBaseline : leagueWindow(leagueGames)
  const basis: ComparisonBasis = useOwnForm ? 'own-form' : 'league'

  const comparisons: PerformanceComparison[] = []
  for (const metric of METRICS) {
    const windowValue = metric.value(window)
    const referenceValue = metric.value(reference)
    if (windowValue === null || referenceValue === null) continue

    const delta = windowValue - referenceValue
    if (Math.abs(delta) < metric.threshold) continue

    const improvement = metric.higherIsBetter ? delta : -delta
    comparisons.push({
      metricId: metric.id,
      label: metric.label,
      side: metric.side,
      basis,
      windowValue,
      referenceValue,
      improvement,
      formatted: {
        window: metric.format(windowValue),
        reference: metric.format(referenceValue),
        improvement: metric.formatDelta(Math.abs(delta)),
      },
    })
  }

  // Best news first, then worst -- a GM should see what is working before what isn't, and a screen
  // that opens with its good news reads as a report rather than as a complaint.
  return comparisons.sort((a, b) => b.improvement - a.improvement)
}

/** Turns a comparison into the sentence shown on screen. */
export function describePerformance(comparison: PerformanceComparison): string {
  const better = comparison.improvement > 0
  const { window, reference, improvement } = comparison.formatted

  if (comparison.basis === 'league') {
    const standing = better ? 'better than' : 'worse than'
    return `${capitalize(comparison.label)}: ${window}, ${improvement} ${standing} the league average of ${reference}.`
  }

  // "better/worse" rather than "up/down", because half these metrics improve by falling. Points
  // allowed dropping from 131 to 122 is the defence working, and "up 9.0 on your 131.0" read as the
  // exact opposite of what had happened.
  const standing = better ? 'better than' : 'worse than'
  return `${capitalize(comparison.label)}: ${window}, ${improvement} ${standing} your ${reference} before this stretch.`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The same comparisons as CoachingInsights, so they travel through the machinery that already
 * exists: collapsed at a checkpoint (run/chunkInsightSummary.ts), kept for the run
 * (run/runInsights.ts), and shown wherever insights are shown.
 *
 * Keyed on the *metric* rather than a player, which is what `subjectId` means for a team-level
 * insight -- and is exactly the stable key recurrence counting needs, so "your three-point shooting
 * was down in three separate stretches" falls out of the existing aggregation for free.
 */
export function performanceInsights(
  windowGames: Game[],
  baselineGames: Game[],
  leagueGames: Game[],
  teamId: TeamId,
): CoachingInsight[] {
  return comparePerformance(windowGames, baselineGames, leagueGames, teamId).map((comparison) => ({
    teamId,
    kind: 'performance-trend' as const,
    subjectId: comparison.metricId,
    subjectName: comparison.label,
    tone: comparison.improvement > 0 ? ('positive' as const) : ('negative' as const),
    side: comparison.side,
    text: describePerformance(comparison),
  }))
}
