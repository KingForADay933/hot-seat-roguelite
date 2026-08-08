import { DEFENSIVE_SCHEMES, OFFENSIVE_PLAYBOOKS } from '../data/presets'
import type { Game, OnCourtRecord, Player, PossessionLogEntry, Team } from '../data/types'
import { deriveBoxScore } from './boxScore'
import { OVERTIME_SECONDS, PERIOD_SECONDS, REGULATION_PERIODS } from './constants'
import { playersOf, type OnCourtPlayer } from './matchup'
import { effectiveFive } from './positionFit'
import { computeOffenseStrength, synergyMultiplier } from './possession/possessionStrength'
import { getInvolvedPlayerIds, selectPlayers } from './possession/playerSelector'
import { selectPlayCall } from './possession/playCallSelector'
import { possessionDurationSeconds } from './possession/possessionDuration'
import { offensiveReboundProbability } from './possession/rebound'
import { resolvePossession } from './possession/outcomeResolver'
import { computeResistance } from './possession/resistance'
import { tickFatigue } from './rotation/fatigue'
import { createRotationState } from './rotation/rotationState'
import { checkSubstitutions } from './rotation/substitution'
import type { Rng } from './rng'

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
): Generator<SimulationStep, Game> {
  const homeRoster = resolveRoster(homeTeam, playersById)
  const awayRoster = resolveRoster(awayTeam, playersById)
  const homeRotation = createRotationState(homeTeam, playersById)
  const awayRotation = createRotationState(awayTeam, playersById)

  const homePlaybook = OFFENSIVE_PLAYBOOKS[homeTeam.offensiveStrategyId]
  const awayPlaybook = OFFENSIVE_PLAYBOOKS[awayTeam.offensiveStrategyId]
  const homeScheme = DEFENSIVE_SCHEMES[homeTeam.defensiveStrategyId]
  const awayScheme = DEFENSIVE_SCHEMES[awayTeam.defensiveStrategyId]
  // Computed once -- synergyScore doesn't change mid-game.
  const homeSynergy = synergyMultiplier(homeTeam.synergyScore)
  const awaySynergy = synergyMultiplier(awayTeam.synergyScore)

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
      const playbook = homeIsOffense ? homePlaybook : awayPlaybook
      const scheme = homeIsOffense ? awayScheme : homeScheme
      const synergy = homeIsOffense ? homeSynergy : awaySynergy
      const scoreMargin = homeIsOffense ? homeScore - awayScore : awayScore - homeScore

      const playCall = selectPlayCall(playbook, rng)
      const selection = selectPlayers(playCall, offenseFive, defenseFive, scheme, rng)
      const strength = computeOffenseStrength(playCall, selection, playbook, offenseOnCourt, synergy)
      const resistance = computeResistance(playCall, selection, scheme, offenseOnCourt, defenseOnCourt)
      const resolved = resolvePossession(playCall, selection, strength, resistance, clock, isFinalPeriod, scoreMargin, rng)

      // Only a miss can be rebounded by the offense: a make is inbounded by the other team, a
      // turnover hands it over, and a foul stops play for free throws.
      const offensiveRebound =
        resolved.outcome === 'miss' && rng() < offensiveReboundProbability(offenseOnCourt, defenseOnCourt)

      // Duration is sampled after resolution because the outcome shapes it -- a turnover cuts the
      // action short, a miss adds the rebound scramble. Clamped to the clock so a period never
      // runs long.
      const durationSeconds = Math.min(
        clock,
        possessionDurationSeconds(playCall, resolved.outcome, possessionsPerGame, rng, isSecondChance),
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

      yield { entry, homeScore, awayScore }
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

  const result = deriveBoxScore(possessionLog, homeTeam.id, playersById, rng)

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
