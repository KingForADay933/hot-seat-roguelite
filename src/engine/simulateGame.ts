import { DEFENSIVE_SCHEMES, OFFENSIVE_PLAYBOOKS } from '../data/presets'
import type { Game, Player, PossessionLogEntry, Team } from '../data/types'
import { deriveBoxScore } from './boxScore'
import { OVERTIME_MINUTES, REGULATION_MINUTES } from './constants'
import { computeOffenseStrength } from './possession/possessionStrength'
import { getInvolvedPlayerIds, selectPlayers } from './possession/playerSelector'
import { selectPlayCall } from './possession/playCallSelector'
import { resolvePossession } from './possession/outcomeResolver'
import { computeResistance } from './possession/resistance'
import { tickFatigue } from './rotation/fatigue'
import { createRotationState } from './rotation/rotationState'
import { checkSubstitutions } from './rotation/substitution'
import type { Rng } from './rng'

function resolveRoster(team: Team, playersById: Map<string, Player>): Player[] {
  return team.rosterPlayerIds.map((id) => {
    const player = playersById.get(id)
    if (!player) throw new Error(`Player ${id} on ${team.name}'s roster was not found`)
    return player
  })
}

/**
 * Length of one overtime period, in possessions, at the same pace as regulation -- mirrors the
 * real NBA's 5-minute (5/12 of a 12-minute quarter) extra period. Floored at 1 so a very low
 * possessionsPerGame configuration can never produce a zero-length period, which would make the
 * "keep playing until someone wins" loop in simulateGame spin forever without the score changing.
 */
export function computeOvertimePossessions(possessionsPerGame: number): number {
  return Math.max(1, Math.round((OVERTIME_MINUTES / REGULATION_MINUTES) * possessionsPerGame))
}

/**
 * Which period a given possession falls in, for live display -- "Q1"-"Q4" during regulation (split
 * evenly across possessionsPerGame), then "OT"/"2OT"/... beyond that, mirroring formatOvertimeLabel
 * (ui/formatOvertime.ts). Presentation-only: derived from possession counts, the same way
 * minutesPlayed already stands in for a real game clock (Section 13), not a new engine concept --
 * lives here (not in ui/) because Coaching Insights (engine code) needs it too.
 */
export function getPeriodLabel(possessionNumber: number, possessionsPerGame: number): string {
  if (possessionNumber <= possessionsPerGame) {
    const quarterLength = possessionsPerGame / 4
    const quarter = Math.min(4, Math.max(1, Math.ceil(possessionNumber / quarterLength)))
    return `Q${quarter}`
  }
  const overtimePossessions = computeOvertimePossessions(possessionsPerGame)
  const overtimeNumber = Math.ceil((possessionNumber - possessionsPerGame) / overtimePossessions)
  return overtimeNumber === 1 ? 'OT' : `${overtimeNumber}OT`
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
 * MVP simplification: offense alternates home/away on a fixed count rather than being triggered by
 * live rebounds/makes -- who gets first possession of a period (including the opening tip, not
 * just overtime) is decided by a jump ball (rollJumpBall), and alternates from there.
 *
 * Bench rotation: each team's on-court five starts as its startingFive and changes over the game
 * via fatigue/pace-driven substitutions (see engine/rotation) -- see each possession's logged
 * homeOnCourtIds/awayOnCourtIds for who was actually on the floor. Fatigue/rotation state carries
 * continuously from regulation into overtime, exactly like a real game.
 *
 * Overtime: if regulation ends tied, extra periods (Section 14.2) run until the tie breaks --
 * never capped, matching the real rules. Each period, including regulation's opening tip, gets
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

  const possessionLog: PossessionLogEntry[] = []
  let homeScore = 0
  let awayScore = 0
  let possessionNumber = 0 // overall counter across the whole game, regulation + every overtime

  /** Runs one period (regulation or a single overtime) of `periodLength` possessions. */
  function* runPeriod(periodLength: number, homeStartsOnOffense: boolean): Generator<SimulationStep> {
    for (let periodPossession = 1; periodPossession <= periodLength; periodPossession++) {
      possessionNumber += 1

      // Snapshot both fives before checking either team's subs, so neither team's matchup-fit
      // scoring sees the other team's just-updated five for this possession.
      const homeOnCourtBefore = [...homeRotation.onCourt]
      const awayOnCourtBefore = [...awayRotation.onCourt]
      checkSubstitutions(homeRotation, homeTeam, awayOnCourtBefore, playersById, possessionNumber)
      checkSubstitutions(awayRotation, awayTeam, homeOnCourtBefore, playersById, possessionNumber)

      const homeIsOffense = homeStartsOnOffense ? periodPossession % 2 === 1 : periodPossession % 2 === 0
      const offenseTeam = homeIsOffense ? homeTeam : awayTeam
      const offenseOnCourt = homeIsOffense ? homeRotation.onCourt : awayRotation.onCourt
      const defenseOnCourt = homeIsOffense ? awayRotation.onCourt : homeRotation.onCourt
      const playbook = homeIsOffense ? homePlaybook : awayPlaybook
      const scheme = homeIsOffense ? awayScheme : homeScheme
      const scoreMargin = homeIsOffense ? homeScore - awayScore : awayScore - homeScore

      const playCall = selectPlayCall(playbook, rng)
      const selection = selectPlayers(playCall, offenseOnCourt, defenseOnCourt, scheme, rng)
      const strength = computeOffenseStrength(playCall, selection, playbook, offenseOnCourt)
      const resistance = computeResistance(playCall, selection, scheme, offenseOnCourt, defenseOnCourt)
      const resolved = resolvePossession(
        playCall,
        selection,
        strength,
        resistance,
        periodPossession,
        periodLength,
        scoreMargin,
        rng,
      )

      if (resolved.outcome === 'make') {
        if (homeIsOffense) homeScore += resolved.pointsScored
        else awayScore += resolved.pointsScored
      }

      const entry: PossessionLogEntry = {
        possessionNumber,
        offenseTeamId: offenseTeam.id,
        playCallUsed: playCall,
        primaryPlayerId: selection.primary.id,
        secondaryPlayerIds: selection.secondaries.map((p) => p.id),
        outcome: resolved.outcome,
        pointsScored: resolved.pointsScored,
        isThreePointAttempt: selection.isOutsideShotAction,
        playersInvolved: getInvolvedPlayerIds(selection),
        homeOnCourtIds: homeRotation.onCourt.map((p) => p.id),
        awayOnCourtIds: awayRotation.onCourt.map((p) => p.id),
      }
      possessionLog.push(entry)

      tickFatigue(homeRotation, homeRoster)
      tickFatigue(awayRotation, awayRoster)

      yield { entry, homeScore, awayScore }
    }
  }

  yield* runPeriod(possessionsPerGame, rollJumpBall(rng))

  const overtimePossessions = computeOvertimePossessions(possessionsPerGame)
  let overtimePeriods = 0
  while (homeScore === awayScore) {
    overtimePeriods += 1
    yield* runPeriod(overtimePossessions, rollJumpBall(rng))
  }

  const result = deriveBoxScore(possessionLog, homeTeam.id, playersById, possessionsPerGame, rng)

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
