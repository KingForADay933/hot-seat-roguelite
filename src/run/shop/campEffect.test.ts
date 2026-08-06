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
  it('boosts only the targeted player, only on the chosen attribute, within the bounded shift range', () => {
    const roster = makeRoster(3)
    const target = roster[1]
    const result = applyPlayerCamp(roster, target.id, 'insideShot', createSeededRng(1))

    const updatedTarget = result.find((p) => p.id === target.id)!
    // See the applyTeamCamp test below for why this is >= rather than a guaranteed increase --
    // a single-attribute shift can round-trip to the same 10-attribute-average overallRating.
    expect(updatedTarget.overallRating).toBeGreaterThanOrEqual(target.overallRating)
    expect(updatedTarget.attributes.insideShot - target.attributes.insideShot).toBeGreaterThanOrEqual(CAMP_ATTRIBUTE_SHIFT_MIN)
    expect(updatedTarget.attributes.insideShot - target.attributes.insideShot).toBeLessThanOrEqual(CAMP_ATTRIBUTE_SHIFT_MAX)
    expect(updatedTarget.attributes.outsideShot).toBe(target.attributes.outsideShot)

    for (const p of result.filter((p) => p.id !== target.id)) {
      const original = roster.find((r) => r.id === p.id)!
      expect(p.attributes).toEqual(original.attributes)
    }
  })
})

describe('applyTeamCamp', () => {
  it('boosts the chosen attribute for every player on the given team, and leaves other teams untouched', () => {
    const roster = makeRoster(3)
    const other = makeTestPlayer()
    other.teamId = 'other-team'
    const players = [...roster, other]

    const result = applyTeamCamp(players, TEAM_ID, 'insideShot', createSeededRng(1))

    for (const p of roster) {
      const updated = result.find((r) => r.id === p.id)!
      // A single-attribute shift moves the 10-attribute average so little it can round to the same
      // overallRating -- unlike the old uniform-shift-every-attribute camp, so this only asserts
      // no *decrease*, not a guaranteed bump.
      expect(updated.overallRating).toBeGreaterThanOrEqual(p.overallRating)
      expect(updated.attributes.insideShot - p.attributes.insideShot).toBeLessThanOrEqual(TEAM_CAMP_ATTRIBUTE_SHIFT_MAX)
      expect(updated.attributes.outsideShot).toBe(p.attributes.outsideShot)
    }

    const updatedOther = result.find((r) => r.id === other.id)!
    expect(updatedOther.attributes).toEqual(other.attributes)
  })
})
