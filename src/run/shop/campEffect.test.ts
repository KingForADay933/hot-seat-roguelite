import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../../engine/testFixtures'
import { createSeededRng } from '../../engine/rng'
import { CAMP_ATTRIBUTE_SHIFT_MAX, CAMP_ATTRIBUTE_SHIFT_MIN, TEAM_CAMP_ATTRIBUTE_SHIFT_MAX, TEAM_CAMP_ATTRIBUTE_SHIFT_MIN } from '../constants'
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
  it('boosts only the targeted player, on only the chosen attribute, within the bounded shift range', () => {
    const roster = makeRoster(3)
    const target = roster[1]
    const result = applyPlayerCamp(roster, target.id, 'outsideShot', createSeededRng(1))

    const updatedTarget = result.find((p) => p.id === target.id)!
    expect(updatedTarget.overallRating).toBeGreaterThanOrEqual(target.overallRating)
    expect(updatedTarget.attributes.outsideShot - target.attributes.outsideShot).toBeGreaterThanOrEqual(CAMP_ATTRIBUTE_SHIFT_MIN)
    expect(updatedTarget.attributes.outsideShot - target.attributes.outsideShot).toBeLessThanOrEqual(CAMP_ATTRIBUTE_SHIFT_MAX)
    // Every other attribute on the targeted player is untouched.
    for (const key of Object.keys(updatedTarget.attributes) as (keyof typeof updatedTarget.attributes)[]) {
      if (key === 'outsideShot') continue
      expect(updatedTarget.attributes[key]).toBe(target.attributes[key])
    }

    for (const p of result.filter((p) => p.id !== target.id)) {
      const original = roster.find((r) => r.id === p.id)!
      expect(p.attributes).toEqual(original.attributes)
    }
  })
})

describe('applyTeamCamp', () => {
  it('boosts every player on the given team on the chosen attribute, and leaves other teams untouched', () => {
    const roster = makeRoster(3)
    const other = makeTestPlayer()
    other.teamId = 'other-team'
    const players = [...roster, other]

    const result = applyTeamCamp(players, TEAM_ID, 'rebounding', createSeededRng(1))

    for (const p of roster) {
      const updated = result.find((r) => r.id === p.id)!
      // A 2-4 point bump to one of ten attributes is often too small to move the rounded
      // overallRating average, so the meaningful assertion is the targeted attribute itself.
      const shift = updated.attributes.rebounding - p.attributes.rebounding
      expect(shift).toBeGreaterThanOrEqual(TEAM_CAMP_ATTRIBUTE_SHIFT_MIN)
      expect(shift).toBeLessThanOrEqual(TEAM_CAMP_ATTRIBUTE_SHIFT_MAX)
      expect(updated.attributes.insideShot).toBe(p.attributes.insideShot)
    }

    const updatedOther = result.find((r) => r.id === other.id)!
    expect(updatedOther.attributes).toEqual(other.attributes)
  })
})
