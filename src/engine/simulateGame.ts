import { DEFENSIVE_SCHEMES, OFFENSIVE_PLAYBOOKS } from '../data/presets'
import type { Game, OnCourtRecord, Player, PossessionLogEntry, TacticalFocus, Team, TeamId } from '../data/types'
import { deriveBoxScore } from './boxScore'
import { OVERTIME_SECONDS, PERIOD_SECONDS, REGULATION_PERIODS } from './constants'
import { playersOf, type OnCourtPlayer } from './matchup'
import { effectiveFive } from './positionFit'
import { computeOffenseStrength, synergyMultiplier } from './possession/possessionStrength'
import { getInvolvedPlayerIds, selectPlayers } from './possession/playerSelector'
import { selectPlayCall } from './possession/playCallSelector'
import { possessionDurationSeconds } from './possession/possessionDuration'
import { offensiveReboundProbability, pickRebounder } from './possession/rebound'
import { resolvePossession } from './possession/outcomeResolver'
import { computeResistance } from './possession/resistance'
import { tickFatigue } from './rotation/fatigue'
import { createRotationState } from './rotation/rotationState'
import { checkSubstitutions } from './rotation/substitution'
import type { Rng } from './rng'
import {
  fastBreakResistanceScale,
  focusedPlaybook,
  focusPaceEfficiency,
  focusPaceScale,
  focusReboundOffset,
} from './tacticalFocus'

/** Flattens a slot-assigned five into the form the possession log records it in. */
function toOnCourtRecords(five: OnCourtPlayer[]): OnCourtRecord[] {
  return five.map((entry) => ({ playerId: entry.player.id, slot: entry.slot }))
}

function resolveRoster(team: Team, playersById: Map<string, Player>): Player[] {
  return team.rosterPlayerIds.map((id) => {
    const player = playersById.get(id)
    if (!player) throw new Error(`Player ${id} on ${team.name}'s roster was not found`)
    return player
  })
}

/**
 * "Q1"-"Q4" during regulation, then "OT"/"2OT"/... beyond it, mirroring formatOvertimeLabel
 * (ui/formatOvertime.ts). Now a straight lookup on the period the possession was actually played
 * in, rather than the old approximation that sliced a possession count into four -- the loop runs
 * one real period at a time. Lives here (not in ui/) because Coaching Insights needs it too.
 */
export function getPeriodLabel(period: number): string {
  if (period <= REGULATION_PERIODS) return `Q${period}`
  const overtimeNumber = period - REGULATION_PERIODS
  return overtimeNumber === 1 ? 'OT' : `${overtimeNumber}OT`
}

/** mm:ss for a scoreboard, rounding up so a possession ending at 0.4s left still reads 0:01. */
export function formatGameClock(secondsRemaining: number): string {
  const total = Math.max(0, Math.ceil(secondsRemaining))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Decides which team gets first possession of a period (the opening tip, and the start of every
 * overtime). A neutral coin flip for now -- not skill-weighted by a center's Vertical or similar --
 * kept simple deliberately (Section 5.5.2). Named and exported (rather than inlined) because the
 * *first* possession logged for a period is exactly this outcome, and future consumers of the
 * possession log -- Broadcast Commentary, Simcast -- will want to narrate/animate that moment
 * explicitly rather than re-deriving "who won the tip" from possession order.
 */
export function rollJumpBall(rng: Rng): boolean {
  return rng() < 0.5
}

/** One possession's worth of progress, yielded by simulateGameSteps as it runs. */
export interface SimulationStep {
  entry: PossessionLogEntry
  homeScore: number
  awayScore: number
}

/**
 * An instruction handed back into the running game, by passing it to the generator's `next()`.
 *
 * This is the interactive-coaching hook the generator was shaped for, taking its first real user:
 * a GM watching a simcast can change the defence they are running without waiting for the final
 * buzzer. It applies from the *next* possession onward -- the one already yielded has been resolved
 * and logged, and rewriting it would make the broadcast disagree with the box score.
 *
 * Named by team rather than assumed to be the user's, because the engine has no concept of which
 * team a human is coaching and should not acquire one.
 */
export type CoachingDirective =
  | { kind: 'defensive-scheme'; teamId: TeamId; schemeId: string }
  /**
   * The dials, plus the synergy score they imply.
   *
   * Carrying the score looks redundant until you ask who could compute it: shot selection changes
   * the play-call mix, synergy scores the roster against that mix, and the function that scores it
   * (run/variation/systemDraft.ts's computeInitialSynergyScore) lives a layer above the engine,
   * which never imports from `run/`. Rather than invert that, the sender -- which is UI, and already
   * holds the bundle -- resolves the number and hands it over. Consistent rather than a workaround:
   * the engine is already told its synergy this way, via Team.synergyScore.
   */
  | { kind: 'tactical-focus'; teamId: TeamId; focus: TacticalFocus; synergyScore: number }

/**
 * Simulates one game possession-by-possession (Section 5.5's independent resolution model),
 * yielding a SimulationStep after each possession is resolved, and returning the completed Game
 * with its possession log and derived box score once every period (including any overtime) has
 * finished. Yielding one possession at a time -- rather than computing everything up front -- is
 * what lets a caller (Live Playback, Section 14.2) reveal the game as it happens instead of all at
 * once, and is the pause point future interactive coaching decisions (timeouts, subs, matchup/
 * emphasis changes) will hook into.
 *
 * The game is driven by a clock, not a possession count: four real 12-minute periods, each running
 * until its time expires, so how many possessions a team gets is an outcome of how long its
 * possessions take (see possession/possessionDuration.ts). `possessionsPerGame` survives as the
 * league-wide pace scale that sizes those durations rather than as a loop bound, which is what lets
 * a fast playbook genuinely out-pace a slow one.
 *
 * MVP simplification: offense alternates home/away on a fixed count rather than being triggered by
 * live rebounds/makes -- who gets first possession of a period (including the opening tip, not
 * just overtime) is decided by a jump ball (rollJumpBall), and alternates from there.
 *
 * Bench rotation: each team's on-court five starts as its startingFive and changes over the game
 * via fatigue/pace-driven substitutions (see engine/rotation) -- see each possession's logged
 * homeOnCourt/awayOnCourt for who was on the floor and which slot each filled. Fatigue/rotation state carries
 * continuously from regulation into overtime, exactly like a real game, and both are measured in
 * game seconds so a fast break costs less than a ground-out post-up.
 *
 * Overtime: if regulation ends tied, extra 5-minute periods (Section 14.2) run until the tie breaks
 * -- never capped, matching the real rules. Each period, including regulation's opening tip, gets
 * its own independent jump ball rather than continuing the previous period's alternating pattern.
 */
export function* simulateGameSteps(
  game: Game,
  homeTeam: Team,
  awayTeam: Team,
  playersById: Map<string, Player>,
  possessionsPerGame: number,
  rng: Rng,
): Generator<SimulationStep, Game, CoachingDirective | undefined> {
  const homeRoster = resolveRoster(homeTeam, playersById)
  const awayRoster = resolveRoster(awayTeam, playersById)
  const homeRotation = createRotationState(homeTeam, playersById)
  const awayRotation = createRotationState(awayTeam, playersById)

  // Every one of these is re-readable rather than fixed for the game, because a CoachingDirective
  // can move it between possessions. The scheme got there first (mid-broadcast defensive switching);
  // focus points brought the other three with them. Synergy in particular used to be a `const` with
  // a comment saying it couldn't change mid-game -- shot selection changes the play-call mix, so it
  // can, and leaving it fixed would have quietly left the multiplier describing the wrong offense.
  let homeFocus = homeTeam.tacticalFocus
  let awayFocus = awayTeam.tacticalFocus
  let homePlaybook = focusedPlaybook(OFFENSIVE_PLAYBOOKS[homeTeam.offensiveStrategyId], homeFocus)
  let awayPlaybook = focusedPlaybook(OFFENSIVE_PLAYBOOKS[awayTeam.offensiveStrategyId], awayFocus)
  let homeScheme = DEFENSIVE_SCHEMES[homeTeam.defensiveStrategyId]
  let awayScheme = DEFENSIVE_SCHEMES[awayTeam.defensiveStrategyId]
  let homeSynergy = synergyMultiplier(homeTeam.synergyScore)
  let awaySynergy = synergyMultiplier(awayTeam.synergyScore)

  /** Ignores a directive naming a team that isn't playing, or a scheme that doesn't exist -- the
   *  engine is the last boundary before a bad id would reach possession resolution. Exhaustive over
   *  the union on purpose (D1): a kind added for M6's substitutions and timeouts will fail to
   *  compile here rather than being silently dropped. */
  function applyDirective(directive: CoachingDirective): void {
    const isHome = directive.teamId === homeTeam.id
    if (!isHome && directive.teamId !== awayTeam.id) return

    switch (directive.kind) {
      case 'defensive-scheme': {
        const scheme = DEFENSIVE_SCHEMES[directive.schemeId]
        if (!scheme) return
        if (isHome) homeScheme = scheme
        else awayScheme = scheme
        return
      }
      case 'tactical-focus': {
        const team = isHome ? homeTeam : awayTeam
        const playbook = focusedPlaybook(OFFENSIVE_PLAYBOOKS[team.offensiveStrategyId], directive.focus)
        if (isHome) {
          homeFocus = directive.focus
          homePlaybook = playbook
          homeSynergy = synergyMultiplier(directive.synergyScore)
        } else {
          awayFocus = directive.focus
          awayPlaybook = playbook
          awaySynergy = synergyMultiplier(directive.synergyScore)
        }
        return
      }
    }
  }

  const possessionLog: PossessionLogEntry[] = []
  let homeScore = 0
  let awayScore = 0
  let possessionNumber = 0 // overall counter across the whole game, regulation + every overtime
  let elapsedSeconds = 0 // game time elapsed across the whole game, for rotation pacing

  /**
   * Runs one period until its clock expires. Possessions keep starting while any time remains --
   * a trip that begins with two seconds left is a real thing -- and the last one is truncated to
   * whatever was actually on the clock rather than overrunning the period.
   */
  function* runPeriod(period: number, periodSeconds: number, homeStartsOnOffense: boolean): Generator<SimulationStep> {
    const isFinalPeriod = period >= REGULATION_PERIODS
    let clock = periodSeconds
    let homeIsOffense = homeStartsOnOffense
    // Set when the previous attempt was rebounded by its own offense, making this one a putback
    // rather than a fresh trip up the floor.
    let isSecondChance = false
    // Set when the previous possession was a miss the *defense* rebounded, so the ball has turned
    // over live and whoever just shot is now defending in transition. Whether that costs them
    // anything is decided by their glass dial, not by this flag -- which is what keeps a balanced
    // team's game byte-identical. Exactly the shape of isSecondChance above, and the only
    // cross-possession state focus points needed.
    let isFastBreak = false

    while (clock > 0) {
      possessionNumber += 1

      // Snapshot both fives before checking either team's subs, so neither team's matchup-fit
      // scoring sees the other team's just-updated five for this possession.
      const homeOnCourtBefore = [...homeRotation.onCourt]
      const awayOnCourtBefore = [...awayRotation.onCourt]
      const secondsIntoPeriod = periodSeconds - clock
      checkSubstitutions(homeRotation, homeTeam, awayOnCourtBefore, playersById, elapsedSeconds, period, secondsIntoPeriod)
      checkSubstitutions(awayRotation, awayTeam, homeOnCourtBefore, playersById, elapsedSeconds, period, secondsIntoPeriod)

      const offenseTeam = homeIsOffense ? homeTeam : awayTeam
      // Position-fit-adjusted for possession resolution only (rotation-charts.md Phase E):
      // selectPlayers, computeOffenseStrength, computeResistance and offensiveReboundProbability all
      // read player.attributes, so handing them the shifted five propagates an out-of-position
      // penalty everywhere below this line with no further call-site changes. Rotation state itself
      // (homeRotation.onCourt/awayRotation.onCourt) stays untouched -- fatigue, substitution choice
      // and the possession log all still see the real players.
      const offenseFive = effectiveFive(homeIsOffense ? homeRotation.onCourt : awayRotation.onCourt)
      const defenseFive = effectiveFive(homeIsOffense ? awayRotation.onCourt : homeRotation.onCourt)
      // Slot assignment matters to defender pairing; the team-average terms in strength, resistance
      // and rebounding only care who is out there, so they take the plain fives.
      const offenseOnCourt = playersOf(offenseFive)
      const defenseOnCourt = playersOf(defenseFive)
      const scheme = homeIsOffense ? awayScheme : homeScheme
      const synergy = homeIsOffense ? homeSynergy : awaySynergy
      const offenseFocus = homeIsOffense ? homeFocus : awayFocus
      const defenseFocus = homeIsOffense ? awayFocus : homeFocus
      const playbook = homeIsOffense ? homePlaybook : awayPlaybook
      const scoreMargin = homeIsOffense ? homeScore - awayScore : awayScore - homeScore

      const playCall = selectPlayCall(playbook, rng)
      const selection = selectPlayers(playCall, offenseFive, defenseFive, scheme, rng)
      const strength = computeOffenseStrength(
        playCall,
        selection,
        playbook,
        offenseOnCourt,
        synergy * focusPaceEfficiency(offenseFocus),
      )
      // The glass dial's whole cost and payout, on the one trip where it means anything: the
      // defense here is the team that just missed, so crashing means they are not back yet and
      // getting back means they arrived set. 1 for a balanced team, which is why an un-dialled
      // game is unchanged.
      const resistance =
        computeResistance(playCall, selection, scheme, offenseOnCourt, defenseOnCourt, defenseFocus) *
        (isFastBreak ? fastBreakResistanceScale(defenseFocus) : 1)
      const resolved = resolvePossession(playCall, selection, strength, resistance, clock, isFinalPeriod, scoreMargin, rng)

      // Only a miss can be rebounded by the offense: a make is inbounded by the other team, a
      // turnover hands it over, and a foul stops play for free throws.
      const offensiveRebound =
        resolved.outcome === 'miss' &&
        rng() < offensiveReboundProbability(offenseOnCourt, defenseOnCourt, focusReboundOffset(offenseFocus))
      // Who actually came down with it, decided here rather than in deriveBoxScore so the rebounder
      // exists while the possession is still happening -- the live box score and commentary both
      // read the log, and neither can see a stat that isn't settled until the final buzzer.
      const rebounderId =
        resolved.outcome === 'miss'
          ? pickRebounder(offensiveRebound ? offenseOnCourt : defenseOnCourt, rng).id
          : null

      // Duration is sampled after resolution because the outcome shapes it -- a turnover cuts the
      // action short, a miss adds the rebound scramble. Clamped to the clock so a period never
      // runs long.
      const durationSeconds = Math.min(
        clock,
        possessionDurationSeconds(
          playCall,
          resolved.outcome,
          possessionsPerGame,
          rng,
          isSecondChance,
          focusPaceScale(offenseFocus),
        ),
      )
      clock -= durationSeconds
      elapsedSeconds += durationSeconds

      // Not gated on outcome === 'make' any more: a shooting foul scores whatever dropped at the
      // line, and every other outcome reports 0, so adding unconditionally is both simpler and the
      // only way free-throw points reach the scoreboard.
      if (homeIsOffense) homeScore += resolved.pointsScored
      else awayScore += resolved.pointsScored

      const entry: PossessionLogEntry = {
        possessionNumber,
        period,
        // The scheme this possession was actually defended with, which a mid-game directive can
        // change from one entry to the next.
        defenseSchemeId: scheme.id,
        clockSecondsRemaining: clock,
        durationSeconds,
        offenseTeamId: offenseTeam.id,
        playCallUsed: playCall,
        primaryPlayerId: selection.primary.id,
        secondaryPlayerIds: selection.secondaries.map((p) => p.id),
        outcome: resolved.outcome,
        pointsScored: resolved.pointsScored,
        isThreePointAttempt: selection.isOutsideShotAction,
        freeThrowsMade: resolved.freeThrowsMade,
        freeThrowsAttempted: resolved.freeThrowsAttempted,
        offensiveRebound,
        rebounderId,
        stolenById: resolved.stolenById,
        blockedById: resolved.blockedById,
        isSecondChance,
        playersInvolved: getInvolvedPlayerIds(selection),
        homeOnCourt: toOnCourtRecords(homeRotation.onCourt),
        awayOnCourt: toOnCourtRecords(awayRotation.onCourt),
      }
      possessionLog.push(entry)

      tickFatigue(homeRotation, homeRoster, durationSeconds)
      tickFatigue(awayRotation, awayRoster, durationSeconds)

      // The ball only changes hands when the offense doesn't get its own miss back, which is what
      // makes a trip able to span several attempts.
      if (!offensiveRebound) homeIsOffense = !homeIsOffense
      isSecondChance = offensiveRebound
      // A live rebound the other way: the ball has turned over off a miss, so the team that shot it
      // is now getting back. Set for every such board rather than only for a crashing offense, so
      // the flag describes the *situation* and the dial alone decides what it costs.
      isFastBreak = resolved.outcome === 'miss' && !offensiveRebound

      // Whatever the caller hands back takes effect from the next possession -- this one is already
      // resolved and logged.
      const directive = yield { entry, homeScore, awayScore }
      if (directive) applyDirective(directive)
    }
  }

  for (let period = 1; period <= REGULATION_PERIODS; period++) {
    yield* runPeriod(period, PERIOD_SECONDS, rollJumpBall(rng))
  }

  let overtimePeriods = 0
  while (homeScore === awayScore) {
    overtimePeriods += 1
    yield* runPeriod(REGULATION_PERIODS + overtimePeriods, OVERTIME_SECONDS, rollJumpBall(rng))
  }

  const result = deriveBoxScore(possessionLog, homeTeam.id)

  return {
    ...game,
    isPlayed: true,
    possessionLog,
    result: { ...result, overtimePeriods },
  }
}

/**
 * Runs a full game to completion in one call -- a thin wrapper draining simulateGameSteps.
 * Behaviorally identical to the pre-generator implementation: same inputs produce the same Game.
 */
export function simulateGame(
  game: Game,
  homeTeam: Team,
  awayTeam: Team,
  playersById: Map<string, Player>,
  possessionsPerGame: number,
  rng: Rng,
): Game {
  const steps = simulateGameSteps(game, homeTeam, awayTeam, playersById, possessionsPerGame, rng)
  let next = steps.next()
  while (!next.done) next = steps.next()
  return next.value
}
