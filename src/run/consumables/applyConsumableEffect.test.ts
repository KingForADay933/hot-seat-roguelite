import { describe, expect, it } from 'vitest'
import { makeTestPlayer, makeTestTeam } from '../../engine/testFixtures'
import {
  DEFENSIVE_BOOTCAMP_DEFENSE_SHIFT,
  EXTRA_SHOOTAROUND_SHOOTING_SHIFT,
  FILM_ROOM_MARATHON_BALL_HANDLING_SHIFT,
  LOAD_MANAGEMENT_DURABILITY_SHIFT,
  LUCKY_JERSEY_ATTRIBUTE_SHIFT,
  SPORTS_PSYCH_SESSION_CLUTCH_SHIFT,
} from '../constants'
import { applyConsumableEffect } from './applyConsumableEffect'

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

describe('applyConsumableEffect', () => {
  it('sports-psych-session boosts hidden.clutch for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyConsumableEffect('sports-psych-session', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.hidden.clutch).toBe(p.hidden.clutch + SPORTS_PSYCH_SESSION_CLUTCH_SHIFT)
    }
    const untouched = result.players.find((p) => p.teamId === null)!
    expect(untouched.hidden.clutch).toBe(players.find((p) => p.teamId === null)!.hidden.clutch)
  })

  it('load-management boosts hidden.durability for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyConsumableEffect('load-management', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.hidden.durability).toBe(p.hidden.durability + LOAD_MANAGEMENT_DURABILITY_SHIFT)
    }
  })

  it('film-room-marathon boosts ballHandling for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyConsumableEffect('film-room-marathon', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.attributes.ballHandling).toBe(p.attributes.ballHandling + FILM_ROOM_MARATHON_BALL_HANDLING_SHIFT)
    }
  })

  it('extra-shootaround boosts both insideShot and outsideShot for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyConsumableEffect('extra-shootaround', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.attributes.insideShot).toBe(p.attributes.insideShot + EXTRA_SHOOTAROUND_SHOOTING_SHIFT)
      expect(updated.attributes.outsideShot).toBe(p.attributes.outsideShot + EXTRA_SHOOTAROUND_SHOOTING_SHIFT)
    }
  })

  it('defensive-bootcamp boosts both interiorDefense and perimeterDefense for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyConsumableEffect('defensive-bootcamp', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      expect(updated.attributes.interiorDefense).toBe(p.attributes.interiorDefense + DEFENSIVE_BOOTCAMP_DEFENSE_SHIFT)
      expect(updated.attributes.perimeterDefense).toBe(p.attributes.perimeterDefense + DEFENSIVE_BOOTCAMP_DEFENSE_SHIFT)
    }
  })

  it('lucky-jersey boosts every attribute for the roster only', () => {
    const { team, players } = makeRosterAndTeam()
    const result = applyConsumableEffect('lucky-jersey', team, players)
    for (const p of players.filter((p) => p.teamId === team.id)) {
      const updated = result.players.find((r) => r.id === p.id)!
      for (const key of Object.keys(updated.attributes) as (keyof typeof updated.attributes)[]) {
        expect(updated.attributes[key]).toBe(p.attributes[key] + LUCKY_JERSEY_ATTRIBUTE_SHIFT)
      }
    }
  })

  it('energy-drink-sponsorship is a no-op on team/players -- its budget bonus is applied at activation time, not here', () => {
    const { team, players } = makeRosterAndTeam()
    expect(applyConsumableEffect('energy-drink-sponsorship', team, players)).toEqual({ team, players })
  })
})
