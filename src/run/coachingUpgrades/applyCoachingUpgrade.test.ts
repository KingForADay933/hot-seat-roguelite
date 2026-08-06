import { describe, expect, it } from 'vitest'
import { makeTestPlayer, makeTestTeam } from '../../engine/testFixtures'
import {
  BENCH_MOB_ATTRIBUTE_SHIFT,
  CLUTCH_GENE_CLUTCH_SHIFT,
  DEFENSIVE_COORDINATOR_DEFENSE_SHIFT,
  FILM_STUDY_BALL_HANDLING_SHIFT,
  IRON_MAN_DURABILITY_SHIFT,
  PLAYER_DEVELOPMENT_GURU_RATING_BONUS,
  STEADY_HAND_CONSISTENCY_SHIFT,
} from '../constants'
import { applyCoachingUpgrade } from './applyCoachingUpgrade'

function makeRosterAndTeam(size = 3) {
  const team = makeTestTeam()
  const roster = Array.from({ length: size }, () => {
    const p = makeTestPlayer()
    p.teamId = team.id
    return p
  })
  const other = makeTestPlayer() // stays teamId: null -- stands in for "another team's player"
  return { team, players: [...roster, other] }
}

describe('applyCoachingUpgrade', () => {
  it('clutch-gene boosts hidden.clutch for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyCoachingUpgrade('clutch-gene', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.hidden.clutch).toBe(p.hidden.clutch + CLUTCH_GENE_CLUTCH_SHIFT)
    }
    const untouched = result.players.find((p) => p.teamId === null)!
    expect(untouched.hidden.clutch).toBe(players.find((p) => p.teamId === null)!.hidden.clutch)
  })

  it('iron-man-program boosts hidden.durability for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyCoachingUpgrade('iron-man-program', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.hidden.durability).toBe(p.hidden.durability + IRON_MAN_DURABILITY_SHIFT)
    }
  })

  it('film-study boosts ballHandling for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyCoachingUpgrade('film-study', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.attributes.ballHandling).toBe(p.attributes.ballHandling + FILM_STUDY_BALL_HANDLING_SHIFT)
    }
  })

  it('defensive-coordinator boosts both interiorDefense and perimeterDefense for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyCoachingUpgrade('defensive-coordinator', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.attributes.interiorDefense).toBe(p.attributes.interiorDefense + DEFENSIVE_COORDINATOR_DEFENSE_SHIFT)
      expect(updated.attributes.perimeterDefense).toBe(p.attributes.perimeterDefense + DEFENSIVE_COORDINATOR_DEFENSE_SHIFT)
    }
  })

  it('steady-hand boosts hidden.consistency for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyCoachingUpgrade('steady-hand', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.hidden.consistency).toBe(p.hidden.consistency + STEADY_HAND_CONSISTENCY_SHIFT)
    }
  })

  it('player-development-guru boosts headCoachRating and leaves players untouched', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyCoachingUpgrade('player-development-guru', team, players)
    expect(result.team.coaching.headCoachRating).toBe(team.coaching.headCoachRating + PLAYER_DEVELOPMENT_GURU_RATING_BONUS)
    expect(result.players).toEqual(players)
  })

  it('bench-mob-mentality boosts every attribute for current bench players only, not starters', () => {
    const starter = makeTestPlayer()
    const benchPlayer = makeTestPlayer()
    const team = makeTestTeam({ startingFive: [starter.id] })
    starter.teamId = team.id
    benchPlayer.teamId = team.id
    const players = [starter, benchPlayer]

    const result = applyCoachingUpgrade('bench-mob-mentality', team, players)
    const updatedStarter = result.players.find((p) => p.id === starter.id)!
    const updatedBench = result.players.find((p) => p.id === benchPlayer.id)!

    expect(updatedStarter.attributes).toEqual(starter.attributes)
    for (const key of Object.keys(updatedBench.attributes) as (keyof typeof updatedBench.attributes)[]) {
      expect(updatedBench.attributes[key]).toBe(benchPlayer.attributes[key] + BENCH_MOB_ATTRIBUTE_SHIFT)
    }
  })

  it('players-coach and system-guru are no-ops on team/players (their effect lives in synergyBonus)', () => {
    const { team, players } = makeRosterAndTeam()
    expect(applyCoachingUpgrade('players-coach', team, players)).toEqual({ team, players })
    expect(applyCoachingUpgrade('system-guru', team, players)).toEqual({ team, players })
  })
})
