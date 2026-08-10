import { describe, expect, it } from 'vitest'
import type { Game, Player } from '../../data/types'
import { FATIGUE_PENALTY_THRESHOLD, FATIGUE_SUB_OUT_THRESHOLD, SECONDS_PER_MINUTE } from '../constants'
import { generateLeague } from '../generator/randomLeague'
import { createSeededRng } from '../rng'
import { applyBreakRecovery, tickFatigue } from './fatigue'
import { createRotationState } from './rotationState'
import { simulateGameSteps, type SimulationStep } from '../simulateGame'

/**
 * What a whole game's worth of rotation actually looks like, measured rather than asserted piecewise.
 *
 * substitution.test.ts checks the heuristic's individual decisions against hand-built states; this
 * checks the shape those decisions add up to over real games, which is the level the two tuning
 * passes so far have both been argued at. Cheap enough to keep -- 20 games, well under a second --
 * because the numbers it pins are the ones that regressed silently before.
 */
function playGame(seed: number) {
  const rng = createSeededRng(seed)
  const { league, teams, players } = generateLeague({ teamCount: 2, leagueName: 'Rotation', rng })
  const playerById = new Map(players.map((p) => [p.id, p]))
  const scheduled: Game = {
    id: 'g',
    leagueId: league.id,
    homeTeamId: teams[0].id,
    awayTeamId: teams[1].id,
    date: '2026-01-01T00:00:00.000Z',
    isPlayed: false,
    result: null,
    possessionLog: [],
    isSaved: false,
  }

  const steps: SimulationStep[] = []
  const generator = simulateGameSteps(scheduled, teams[0], teams[1], playerById, 200, rng)
  let next = generator.next()
  while (!next.done) {
    steps.push(next.value)
    next = generator.next()
  }

  return { steps, homeTeam: teams[0], playerById, roster: teams[0].rosterPlayerIds.map((id) => playerById.get(id) as Player) }
}

/** Replays one game's fatigue exactly as the sim ran it -- ticks plus the period breaks -- and
 *  tallies what the rotation did with it. */
function measure(seeds: number[]) {
  let substitutions = 0
  let substitutionsWhileSpent = 0
  let minutesError = 0
  let minutesSamples = 0

  for (const seed of seeds) {
    const { steps, homeTeam, playerById, roster } = playGame(seed)
    const state = createRotationState(homeTeam, playerById)
    let previousPeriod = steps[0]?.entry.period ?? 1

    for (let i = 0; i < steps.length; i++) {
      const entry = steps[i].entry
      if (entry.period > previousPeriod) {
        applyBreakRecovery(state.fatigue, roster, previousPeriod)
        previousPeriod = entry.period
      }
      state.onCourt = entry.homeOnCourt.map(({ playerId, slot }) => ({ player: playerById.get(playerId) as Player, slot }))
      tickFatigue(state, roster, entry.durationSeconds)

      const next = steps[i + 1]?.entry
      if (!next) continue
      const stillOn = new Set(next.homeOnCourt.map((o) => o.playerId))
      for (const { playerId } of entry.homeOnCourt) {
        if (stillOn.has(playerId)) continue
        substitutions += 1
        if ((state.fatigue.get(playerId) ?? 0) >= FATIGUE_SUB_OUT_THRESHOLD) substitutionsWhileSpent += 1
      }
    }

    for (const player of roster) {
      minutesError += Math.abs((state.secondsPlayed.get(player.id) ?? 0) / SECONDS_PER_MINUTE - (homeTeam.rotationMinutes[player.id] ?? 0))
      minutesSamples += 1
    }
  }

  return {
    substitutionsPerGame: substitutions / seeds.length,
    spentShare: substitutionsWhileSpent / Math.max(substitutions, 1),
    minutesError: minutesError / minutesSamples,
  }
}

describe('rotation shape over whole games', () => {
  const result = measure(Array.from({ length: 20 }, (_, i) => i + 1))

  it('never pulls a player who has been run into the ground', () => {
    // The property the FATIGUE_ROTATE_THRESHOLD pass established, and the one most easily undone by
    // a later change: resting players earlier is what stopped anyone reaching 80 before coming off.
    expect(result.spentShare).toBe(0)
  })

  it('rotates at a believable rate rather than churning', () => {
    // A real team makes a dozen or so substitutions a game; this engine sits far above that and has
    // done since the chart landed. The band is here to catch a *direction*, not to claim realism:
    // adding period breaks took it from 51.3 to 44.6, and anything that sends it back up past 55 is
    // reintroducing the churn two passes have now worked to remove.
    expect(result.substitutionsPerGame).toBeGreaterThan(25)
    expect(result.substitutionsPerGame).toBeLessThan(55)
  })

  it('lands each player near his target minutes', () => {
    // The over-correction guard. Rest makes the rotation less willing to substitute, and the fear was
    // that starters would simply stop coming off and bench targets would go unmet. Measured, it went
    // the other way: mean error per player improved from 5.80 minutes to 4.82, because less
    // fatigue-driven churn leaves more room for the pace check to do its job.
    expect(result.minutesError).toBeLessThan(6)
  })
})

/**
 * The guard that fatigue still reaches the floor at all.
 *
 * The fatigue penalty (engine/rotation/fatigue.ts's fatiguedPlayer) only bites above
 * FATIGUE_PENALTY_THRESHOLD, and the rotation exists to stop players getting tired. Those two pull
 * against each other, and the rotation can win silently: measured across 30 games, on-court fatigue
 * peaks at 65 and sits at a median of 24, so a threshold set casually against the nominal 0-100
 * scale would have made the whole feature dead code without a single test failing.
 *
 * So this asserts the feature is *reachable*. If a future rotation tune keeps everyone under the
 * threshold, this fails and says why, rather than the penalty quietly ceasing to exist.
 */
describe('fatigue reaches possession resolution', () => {
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1)
  let shotsInPenaltyBand = 0
  let shots = 0
  let peak = 0

  for (const seed of seeds) {
    const { steps, homeTeam, playerById, roster } = playGame(seed)
    const state = createRotationState(homeTeam, playerById)
    let previousPeriod = steps[0]?.entry.period ?? 1

    for (const step of steps) {
      const entry = step.entry
      if (entry.period > previousPeriod) {
        applyBreakRecovery(state.fatigue, roster, previousPeriod)
        previousPeriod = entry.period
      }
      state.onCourt = entry.homeOnCourt.map(({ playerId, slot }) => ({ player: playerById.get(playerId) as Player, slot }))
      tickFatigue(state, roster, entry.durationSeconds)

      for (const { playerId } of entry.homeOnCourt) peak = Math.max(peak, state.fatigue.get(playerId) ?? 0)
      if (entry.offenseTeamId !== homeTeam.id) continue
      if (entry.outcome !== 'make' && entry.outcome !== 'miss') continue
      shots += 1
      if ((state.fatigue.get(entry.primaryPlayerId) ?? 0) >= FATIGUE_PENALTY_THRESHOLD) shotsInPenaltyBand += 1
    }
  }

  it('has a real share of shots taken by a player the penalty applies to', () => {
    // Measured at ~26% of attempts. A floor rather than a band: more tired shooters would be a
    // rotation regression, which the tests above already cover.
    expect(shotsInPenaltyBand / shots).toBeGreaterThan(0.1)
  })

  it('reaches far enough up the band for the penalty to be more than a rounding error', () => {
    // Peak on-court fatigue measured at 65.3 across 30 games, which is why FATIGUE_PENALTY_FULL_AT
    // is 65 rather than 100 -- see its doc comment.
    expect(peak).toBeGreaterThan(FATIGUE_PENALTY_THRESHOLD + 10)
  })
})
