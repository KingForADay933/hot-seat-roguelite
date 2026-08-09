import type { OnCourtRecord, Player, PlayerBoxScoreLine, PlayerId, TeamId } from '../../data/types'
import { ASSIST_ELIGIBLE_PLAY_CALLS } from '../../engine/boxScore'
import { generateCommentaryLine } from '../../engine/commentary/generateCommentaryLine'
import { PERIOD_SECONDS, REGULATION_PERIODS, SECONDS_PER_MINUTE } from '../../engine/constants'
import { fatigueGainPerSecond, fatigueRecoveryPerSecond } from '../../engine/rotation/fatigue'
import { formatGameClock, getPeriodLabel, type SimulationStep } from '../../engine/simulateGame'

/**
 * A running box-score line. Now every counting stat the official box score has, because the
 * possession log determines all of them.
 *
 * Rebounds used to be the exception: the rebounder was rolled inside deriveBoxScore after the game,
 * so showing one live meant either re-rolling every possession (which flickers) or inventing a
 * number that disagreed with the official table at the buzzer. The simulation settles the rebounder
 * when the miss happens now, so the live tally and the final table are the same arithmetic over the
 * same log and agree by construction.
 */
export type LiveBoxScoreLine = PlayerBoxScoreLine

export interface FeedEntry {
  possessionNumber: number
  periodLabel: string
  text: string
  /** Scoring plays get picked out in the feed -- the reason to look up from the box score. Not a
   *  fixed union: a shooting foul scores however many free throws dropped. */
  pointsScored: number
  /** Which side ran the play, for colouring the line by team. */
  offenseTeamId: TeamId
}

export interface PlaybackState {
  possessionsPlayed: number
  homeScore: number
  awayScore: number
  /** Raw period number behind periodLabel -- what useSimcastPlayback compares against to detect an
   *  overtime period actually starting (rotation-charts.md Decision 5), rather than parsing/diffing
   *  the display label. */
  period: number
  periodLabel: string
  /** mm:ss left in the current period -- a real scoreboard clock now that the sim keeps one. */
  clockLabel: string
  /** Newest first, so the screen renders it top-down without reversing on every frame. */
  feed: FeedEntry[]
  /** Who is on the floor and which slot each is filling, straight off the log -- so the panel can
   *  show the assignment the sim used rather than each player's nominal position. */
  homeOnCourt: OnCourtRecord[]
  awayOnCourt: OnCourtRecord[]
  /** 0-100 for every rostered player on both teams, bench included. */
  fatigue: Map<PlayerId, number>
  lines: Map<PlayerId, LiveBoxScoreLine>
  /** Game seconds each player has been on the floor for -- what minutesPlayed is summed from,
   *  matching deriveBoxScore rather than approximating it from a possession count. */
  secondsOnCourt: Map<PlayerId, number>
}

/** Everything the reducer needs that doesn't change as the game runs. */
export interface PlaybackContext {
  homeRoster: Player[]
  awayRoster: Player[]
  playerById: Map<PlayerId, Player>
}

/** How many entries of play-by-play the feed keeps. A full game is ~100 possessions and the screen
 *  shows a handful at a time, so trimming keeps the rendered list short without the GM ever reaching
 *  the bottom of what's kept. */
const FEED_LENGTH = 40

function emptyLine(playerId: PlayerId): LiveBoxScoreLine {
  return {
    playerId,
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
  }
}

/**
 * True exactly when advancing from `previousPeriod` to `nextPeriod` crosses into a *new* overtime
 * period -- the moment Decision 5's substitution prompt fires (rotation-charts.md Phase H).
 * Not true advancing within the same period (most possessions), and not true anywhere in regulation
 * -- periods 1-4 just play on with no prompt, exactly as before.
 */
export function entersNewOvertimePeriod(previousPeriod: number, nextPeriod: number): boolean {
  return nextPeriod > REGULATION_PERIODS && nextPeriod !== previousPeriod
}

export function createPlaybackState(context: PlaybackContext): PlaybackState {
  const roster = [...context.homeRoster, ...context.awayRoster]

  return {
    possessionsPlayed: 0,
    homeScore: 0,
    awayScore: 0,
    period: 1,
    periodLabel: getPeriodLabel(1),
    clockLabel: formatGameClock(PERIOD_SECONDS),
    feed: [],
    homeOnCourt: [],
    awayOnCourt: [],
    fatigue: new Map(roster.map((p) => [p.id, 0])),
    lines: new Map(roster.map((p) => [p.id, emptyLine(p.id)])),
    secondsOnCourt: new Map(roster.map((p) => [p.id, 0])),
  }
}

/**
 * One possession's worth of fatigue for one team, replaying engine/rotation/fatigue.ts's tickFatigue
 * against the five the log says were actually on the floor. Not an approximation: tickFatigue gains
 * for whoever is on court and recovers for everyone else, and the possession log records exactly
 * that five, so the numbers shown here are the ones the simulation used.
 */
function tickTeamFatigue(
  fatigue: Map<PlayerId, number>,
  roster: Player[],
  onCourtIds: PlayerId[],
  elapsedSeconds: number,
): void {
  const onCourt = new Set(onCourtIds)

  for (const player of roster) {
    const current = fatigue.get(player.id) ?? 0
    const next = onCourt.has(player.id)
      ? current + fatigueGainPerSecond(player) * elapsedSeconds
      : current - fatigueRecoveryPerSecond(player) * elapsedSeconds
    fatigue.set(player.id, Math.min(100, Math.max(0, next)))
  }
}

/**
 * Folds one resolved possession into the playback state -- the running score, who's on the floor,
 * everyone's fatigue, the box score, and one more line of commentary.
 *
 * Pure: returns a new state rather than mutating, so React re-renders on identity and a test can
 * step a whole game through it without a clock.
 */
export function advancePlayback(context: PlaybackContext, state: PlaybackState, step: SimulationStep): PlaybackState {
  const { entry } = step

  const fatigue = new Map(state.fatigue)
  const homeIds = entry.homeOnCourt.map((o) => o.playerId)
  const awayIds = entry.awayOnCourt.map((o) => o.playerId)
  tickTeamFatigue(fatigue, context.homeRoster, homeIds, entry.durationSeconds)
  tickTeamFatigue(fatigue, context.awayRoster, awayIds, entry.durationSeconds)

  const secondsOnCourt = new Map(state.secondsOnCourt)
  for (const id of [...homeIds, ...awayIds]) {
    secondsOnCourt.set(id, (secondsOnCourt.get(id) ?? 0) + entry.durationSeconds)
  }

  const lines = new Map(state.lines)
  const bump = (id: PlayerId, change: (line: LiveBoxScoreLine) => void) => {
    const line = { ...(lines.get(id) ?? emptyLine(id)) }
    change(line)
    lines.set(id, line)
  }

  if (entry.outcome === 'make') {
    bump(entry.primaryPlayerId, (line) => {
      line.points += entry.pointsScored
      line.fieldGoalsMade += 1
      line.fieldGoalsAttempted += 1
      if (entry.pointsScored === 3) {
        line.threePointersMade += 1
        line.threePointersAttempted += 1
      }
    })
    if (ASSIST_ELIGIBLE_PLAY_CALLS.includes(entry.playCallUsed) && entry.secondaryPlayerIds[0]) {
      bump(entry.secondaryPlayerIds[0], (line) => (line.assists += 1))
    }
  } else if (entry.outcome === 'miss') {
    bump(entry.primaryPlayerId, (line) => {
      line.fieldGoalsAttempted += 1
      if (entry.isThreePointAttempt) line.threePointersAttempted += 1
    })
    if (entry.rebounderId) bump(entry.rebounderId, (line) => (line.rebounds += 1))
    if (entry.blockedById) bump(entry.blockedById, (line) => (line.blocks += 1))
  } else if (entry.outcome === 'turnover') {
    bump(entry.primaryPlayerId, (line) => (line.turnovers += 1))
    if (entry.stolenById) bump(entry.stolenById, (line) => (line.steals += 1))
  } else if (entry.outcome === 'foul') {
    // Same attribution deriveBoxScore uses: the whistle lands on the offensive player who drew it,
    // since there's no defensive foul model. The free throws it produced do score.
    bump(entry.primaryPlayerId, (line) => {
      line.fouls += 1
      line.freeThrowsMade += entry.freeThrowsMade
      line.freeThrowsAttempted += entry.freeThrowsAttempted
      line.points += entry.pointsScored
    })
  }

  for (const [id, seconds] of secondsOnCourt) {
    const line = lines.get(id)
    if (line) lines.set(id, { ...line, minutesPlayed: seconds / SECONDS_PER_MINUTE })
  }

  const periodLabel = getPeriodLabel(entry.period)
  const feedEntry: FeedEntry = {
    possessionNumber: entry.possessionNumber,
    periodLabel,
    text: generateCommentaryLine(entry, context.playerById),
    pointsScored: entry.pointsScored,
    offenseTeamId: entry.offenseTeamId,
  }

  return {
    possessionsPlayed: state.possessionsPlayed + 1,
    homeScore: step.homeScore,
    awayScore: step.awayScore,
    period: entry.period,
    periodLabel,
    clockLabel: formatGameClock(entry.clockSecondsRemaining),
    feed: [feedEntry, ...state.feed].slice(0, FEED_LENGTH),
    homeOnCourt: entry.homeOnCourt,
    awayOnCourt: entry.awayOnCourt,
    fatigue,
    lines,
    secondsOnCourt,
  }
}
