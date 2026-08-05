import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../../engine/testFixtures'
import { createSeededRng } from '../../engine/rng'
import { CAMP_ATTRIBUTE_SHIFT_MAX, CAMP_ATTRIBUTE_SHIFT_MIN, TEAM_CAMP_ATTRIBUTE_SHIFT_MAX } from '../constants'
import { applyPlayerCamp, applyTeamCamp } from './campEffect'

const TEAM_ID = 'team-1'

function makeRoster(size: number) {
  return Array.from({ length: size }, () => {
    const p = makeTestPlayer()
    p.teamId = TEAM_ID
    return p
  })
}

describe('applyPlayerCamp', () => {
  it('boosts only the targeted player, within the bounded shift range', () => {
    const roster = makeRoster(3)
    const target = roster[1]
    const result = applyPlayerCamp(roster, target.id, createSeededRng(1))

    const updatedTarget = result.find((p) => p.id === target.id)!
    expect(updatedTarget.overallRating).toBeGreaterThan(target.overallRating)
    expect(updatedTarget.attributes.insideShot - target.attributes.insideShot).toBeGreaterThanOrEqual(CAMP_ATTRIBUTE_SHIFT_MIN)
    expect(updatedTarget.attributes.insideShot - target.attributes.insideShot).toBeLessThanOrEqual(CAMP_ATTRIBUTE_SHIFT_MAX)

    for (const p of result.filter((p) => p.id !== target.id)) {
      const original = roster.find((r) => r.id === p.id)!
      expect(p.attributes).toEqual(original.attributes)
    }
  })
})

describe('applyTeamCamp', () => {
  it('boosts every player on the given team, and leaves other teams untouched', () => {
    const roster = makeRoster(3)
    const other = makeTestPlayer()
    other.teamId = 'other-team'
    const players = [...roster, other]

    const result = applyTeamCamp(players, TEAM_ID, createSeededRng(1))

    for (const p of roster) {
      const updated = result.find((r) => r.id === p.id)!
      expect(updated.overallRating).toBeGreaterThan(p.overallRating)
      expect(updated.attributes.insideShot - p.attributes.insideShot).toBeLessThanOrEqual(TEAM_CAMP_ATTRIBUTE_SHIFT_MAX)
    }

    const updatedOther = result.find((r) => r.id === other.id)!
    expect(updatedOther.attributes).toEqual(other.attributes)
  })
})
