import { describe, expect, it } from 'vitest'
import type { Player, PlayerId, Position, Team } from '../data/types'
import { REGULATION_MINUTES } from '../engine/constants'
import { generateTeam } from '../engine/generator/randomTeam'
import { createSeededRng } from '../engine/rng'
import { makeTestPlayer, makeTestTeam } from '../engine/testFixtures'
import { clampToPositionBudget, maxMinutesFor, minMinutesFor, positionMinutesSummary, POSITION_MINUTES_BUDGET } from './minutesBudget'

/** A roster of the given positions, with each player's minutes supplied in the same order. */
function buildTeam(entries: { position: Position; minutes: number }[]): { team: Team; roster: Player[] } {
  const roster = entries.map((e) => makeTestPlayer({ positions: [e.position] }))
  const rotationMinutes: Record<PlayerId, number> = {}
  roster.forEach((p, i) => {
    rotationMinutes[p.id] = entries[i].minutes
  })

  return { team: makeTestTeam({ rosterPlayerIds: roster.map((p) => p.id), rotationMinutes }), roster }
}

describe('POSITION_MINUTES_BUDGET', () => {
  it('is one slot occupied for the whole of regulation', () => {
    expect(POSITION_MINUTES_BUDGET).toBe(REGULATION_MINUTES)
  })
})

describe('maxMinutesFor', () => {
  it('leaves a lone player at his position the whole budget', () => {
    const { team, roster } = buildTeam([{ position: 'PG', minutes: 20 }])
    expect(maxMinutesFor(team, roster, roster[0].id)).toBe(POSITION_MINUTES_BUDGET)
  })

  it('subtracts what positional teammates already hold', () => {
    const { team, roster } = buildTeam([
      { position: 'PG', minutes: 32 },
      { position: 'PG', minutes: 16 },
    ])
    // The group is exactly at budget, so each is already at his own ceiling and neither can rise
    // without the other falling: the ceiling is the budget less what the *other* one holds.
    expect(maxMinutesFor(team, roster, roster[0].id)).toBe(32)
    expect(maxMinutesFor(team, roster, roster[1].id)).toBe(16)
  })

  it('ignores players at other positions', () => {
    const { team, roster } = buildTeam([
      { position: 'PG', minutes: 30 },
      { position: 'C', minutes: 48 },
    ])
    expect(maxMinutesFor(team, roster, roster[0].id)).toBe(POSITION_MINUTES_BUDGET)
  })

  it('floors at zero for a group saved over budget before the rule existed', () => {
    const { team, roster } = buildTeam([
      { position: 'SF', minutes: 48 },
      { position: 'SF', minutes: 40 },
    ])
    expect(maxMinutesFor(team, roster, roster[0].id)).toBe(8)
    expect(maxMinutesFor(team, roster, roster[1].id)).toBe(0)
  })

  it('rounds a fractional ceiling down, so a group can never creep past its budget', () => {
    // Generated targets are unrounded -- ROTATION_DEPTH_WEIGHTS normalized across a group divides
    // 48 into thirds and seventeenths -- so the leftover is fractional more often than not.
    const { team, roster } = buildTeam([
      { position: 'SF', minutes: 32 },
      { position: 'SF', minutes: 14.12 },
    ])
    expect(maxMinutesFor(team, roster, roster[0].id)).toBe(33) // 33.88 truncated, not rounded to 34
    expect(33 + 14.12).toBeLessThanOrEqual(POSITION_MINUTES_BUDGET)
  })

  it('gives nothing to a player who is not on this roster', () => {
    const { team, roster } = buildTeam([{ position: 'PG', minutes: 20 }])
    expect(maxMinutesFor(team, roster, 'someone-else')).toBe(0)
  })
})

describe('clampToPositionBudget', () => {
  it('passes through a value that fits', () => {
    const { team, roster } = buildTeam([
      { position: 'PG', minutes: 32 },
      { position: 'PG', minutes: 16 },
    ])
    expect(clampToPositionBudget(team, roster, roster[0].id, 30)).toBe(30)
  })

  it('caps a request at what the position has left rather than at a flat 48', () => {
    const { team, roster } = buildTeam([
      { position: 'PG', minutes: 32 },
      { position: 'PG', minutes: 16 },
    ])
    // A full 48 would need his backup's 16 minutes too, which are still spoken for.
    expect(clampToPositionBudget(team, roster, roster[0].id, 48)).toBe(32)
    expect(clampToPositionBudget(team, roster, roster[1].id, 48)).toBe(16)
  })

  it('rounds, and floors negatives and non-numbers at zero', () => {
    const { team, roster } = buildTeam([{ position: 'PG', minutes: 20 }])
    expect(clampToPositionBudget(team, roster, roster[0].id, 23.6)).toBe(24)
    expect(clampToPositionBudget(team, roster, roster[0].id, -5)).toBe(0)
    expect(clampToPositionBudget(team, roster, roster[0].id, Number.NaN)).toBe(0)
  })

  it('pulls an over-budget group back inside the budget in one edit', () => {
    const { team, roster } = buildTeam([
      { position: 'SF', minutes: 48 },
      { position: 'SF', minutes: 40 },
    ])
    const clamped = clampToPositionBudget(team, roster, roster[0].id, 48)
    expect(clamped).toBe(8)
    expect(clamped + 40).toBe(POSITION_MINUTES_BUDGET)
  })
})

describe('positionMinutesSummary', () => {
  it('reports every position in PG-to-C order, even ones with nobody at them', () => {
    const { team, roster } = buildTeam([{ position: 'PG', minutes: 48 }])
    expect(positionMinutesSummary(team, roster).map((row) => row.position)).toEqual(['PG', 'SG', 'SF', 'PF', 'C'])
  })

  it('splits assigned from remaining and flags an over-budget group', () => {
    const { team, roster } = buildTeam([
      { position: 'PG', minutes: 30 },
      { position: 'C', minutes: 50 },
    ])
    const byPosition = new Map(positionMinutesSummary(team, roster).map((row) => [row.position, row]))

    expect(byPosition.get('PG')).toMatchObject({ assigned: 30, remaining: 18, isOverBudget: false })
    expect(byPosition.get('C')).toMatchObject({ assigned: 50, remaining: 0, isOverBudget: true })
    expect(byPosition.get('SG')).toMatchObject({ assigned: 0, remaining: 48, isOverBudget: false })
  })
})

describe('the generator already respects the budget', () => {
  it('a depth-chart allocation sums to exactly the budget within each position group', () => {
    // engine/generator/randomTeam.ts normalizes ROTATION_DEPTH_WEIGHTS to REGULATION_MINUTES per
    // group, so enforcing the budget on edits doesn't put existing teams out of compliance.
    const { team, players } = generateTeam({
      name: 'Test',
      city: 'Test',
      abbreviation: 'TST',
      primaryColor: '#000',
      secondaryColor: '#fff',
      offensiveStrategyId: 'balanced',
      defensiveStrategyId: 'manToMan',
      rng: createSeededRng(7),
    })

    for (const row of positionMinutesSummary(team, players)) {
      expect(row.assigned).toBeCloseTo(POSITION_MINUTES_BUDGET, 6)
      expect(row.isOverBudget).toBe(false)
    }
  })
})

describe('house rules narrowing the budget', () => {
  it('minutes-cap lowers a ceiling the position budget would otherwise allow', () => {
    const { team, roster } = buildTeam([{ position: 'PG', minutes: 20 }])
    expect(maxMinutesFor(team, roster, roster[0].id)).toBe(POSITION_MINUTES_BUDGET)
    expect(maxMinutesFor(team, roster, roster[0].id, 'minutes-cap')).toBe(30)
  })

  it('minutes-cap never raises a ceiling the position budget has already lowered', () => {
    const { team, roster } = buildTeam([
      { position: 'PG', minutes: 30 },
      { position: 'PG', minutes: 30 },
    ])
    // The group is over budget, so this player's positional ceiling is 18 -- well under the cap,
    // which must not loosen it back up to 30.
    expect(maxMinutesFor(team, roster, roster[0].id, 'minutes-cap')).toBe(18)
  })

  it('clamps a request down to the cap', () => {
    const { team, roster } = buildTeam([{ position: 'PG', minutes: 20 }])
    expect(clampToPositionBudget(team, roster, roster[0].id, 48, 'minutes-cap')).toBe(30)
    expect(clampToPositionBudget(team, roster, roster[0].id, 48)).toBe(POSITION_MINUTES_BUDGET)
  })

  it('homegrown-mandate refuses to bench a protected player, including at zero', () => {
    const { team, roster } = buildTeam([
      { position: 'PG', minutes: 32 },
      { position: 'SG', minutes: 16 },
    ])
    // Both players sit in a two-man roster's top two, so both are protected.
    expect(clampToPositionBudget(team, roster, roster[0].id, 5, 'homegrown-mandate')).toBe(20)
    expect(clampToPositionBudget(team, roster, roster[0].id, 0, 'homegrown-mandate')).toBe(20)
    // ...and the floor only exists while the rule does.
    expect(clampToPositionBudget(team, roster, roster[0].id, 0)).toBe(0)
  })

  it('leaves an unprotected player free to be benched entirely', () => {
    const { team, roster: flat } = buildTeam([
      { position: 'PG', minutes: 32 },
      { position: 'PG', minutes: 10 },
      { position: 'SG', minutes: 30 },
    ])
    // Ranked explicitly: makeTestPlayer pins every overallRating at 50, which would leave who counts
    // as "best" resting on the id tie-break rather than on anything this test means to assert.
    const roster = flat.map((p, i) => ({ ...p, overallRating: 90 - i * 10 }))
    const worst = roster[2]

    expect(minMinutesFor(roster, worst.id, 'homegrown-mandate')).toBe(0)
    expect(clampToPositionBudget(team, roster, worst.id, 0, 'homegrown-mandate')).toBe(0)
  })
})
