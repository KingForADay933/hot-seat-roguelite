import { describe, expect, it } from 'vitest'
import { createSeededRng, type Rng } from '../../engine/rng'
import { makeTestPlayer } from '../../engine/testFixtures'
import { rollWildcardEvent } from './wildcardEvents'

const TEAM_ID = 'team-1'

function makeRoster(ages: number[]) {
  return ages.map((age) => {
    const p = makeTestPlayer({ age })
    p.teamId = TEAM_ID
    return p
  })
}

/** Deterministic stand-in for tests that need to force a specific branch through the function's
 *  three rng() calls (fire-or-not, breakout-or-slump, which player). */
function fixedRng(...values: number[]): Rng {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('rollWildcardEvent', () => {
  it('does nothing when the fire roll misses', () => {
    const players = makeRoster([25, 25])
    const result = rollWildcardEvent(players, TEAM_ID, fixedRng(0.99))
    expect(result.outcome).toBeNull()
    expect(result.players).toBe(players)
  })

  it('fires a breakout on a young player and boosts their attributes', () => {
    const players = makeRoster([20, 30])
    const result = rollWildcardEvent(players, TEAM_ID, fixedRng(0, 0, 0))
    expect(result.outcome?.eventId).toBe('breakout')
    const target = players.find((p) => p.id === result.outcome?.playerId)!
    expect(target.age).toBeLessThanOrEqual(23) // only the young player was eligible
    const updated = result.players.find((p) => p.id === target.id)!
    expect(updated.overallRating).toBeGreaterThan(target.overallRating)
  })

  it('fires a slump on any player and drops their attributes', () => {
    const players = makeRoster([25])
    const result = rollWildcardEvent(players, TEAM_ID, fixedRng(0, 0.99, 0))
    expect(result.outcome?.eventId).toBe('slump')
    const updated = result.players.find((p) => p.id === result.outcome?.playerId)!
    expect(updated.overallRating).toBeLessThan(50)
  })

  it('skips a breakout roll with no eligible young players rather than throwing', () => {
    const players = makeRoster([30, 35])
    const result = rollWildcardEvent(players, TEAM_ID, fixedRng(0, 0, 0))
    expect(result.outcome).toBeNull()
  })

  it('only ever touches players on the given team', () => {
    const players = [...makeRoster([20]), { ...makeTestPlayer({ age: 20 }), teamId: 'other-team' }]
    for (let seed = 0; seed < 30; seed++) {
      const result = rollWildcardEvent(players, TEAM_ID, createSeededRng(seed))
      if (result.outcome) expect(result.outcome.playerId).not.toBe('other-team')
    }
  })
})
