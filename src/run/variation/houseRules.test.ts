import { describe, expect, it } from 'vitest'
import { generateLeague } from '../../engine/generator/randomLeague'
import { POSITION_ORDER } from '../../engine/matchup'
import { createSeededRng } from '../../engine/rng'
import { makeTestPlayer, makeTestTeam } from '../../engine/testFixtures'
import type { Player, Position, Team } from '../../data/types'
import { POSITION_MINUTES_BUDGET } from '../minutesBudget'
import {
  applyHouseRule,
  HOMEGROWN_MIN_MINUTES,
  HOUSE_RULES,
  houseRuleMinMinutesFor,
  houseRuleMinutesCap,
  houseRuleProtectedPlayerIds,
  pickRandomHouseRules,
  type HouseRuleId,
} from './houseRules'

function buildTeam(ages: Record<Position, number[]>): { team: Team; players: Player[] } {
  const players: Player[] = []
  const rosterPlayerIds: string[] = []
  const startingFive: string[] = []

  ;(Object.keys(ages) as Position[]).forEach((position) => {
    ages[position].forEach((age, i) => {
      const player = makeTestPlayer({ positions: [position], age })
      players.push(player)
      rosterPlayerIds.push(player.id)
      if (i === 0) startingFive.push(player.id) // first entry per position starts
    })
  })

  const team = makeTestTeam({ rosterPlayerIds, startingFive })
  players.forEach((p) => (p.teamId = team.id))
  return { team, players }
}

describe('applyHouseRule / youth-movement', () => {
  it('is a no-op when at least 2 starters are already young', () => {
    const { team, players } = buildTeam({ PG: [20], SG: [21], SF: [30], PF: [30], C: [30] })
    const result = applyHouseRule('youth-movement', team, players)
    expect(result.team.startingFive).toEqual(team.startingFive)
  })

  it('swaps in same-position young bench players until 2 starters qualify', () => {
    const { team, players } = buildTeam({ PG: [30, 20], SG: [30, 21], SF: [30], PF: [30], C: [30] })
    const result = applyHouseRule('youth-movement', team, players)

    const byId = new Map(players.map((p) => [p.id, p]))
    const newStarters = result.team.startingFive.map((id) => byId.get(id)!)
    expect(newStarters.filter((p) => p.age <= 22)).toHaveLength(2)
    // still exactly one starter per position -- the matchup system's invariant
    expect(new Set(newStarters.map((p) => p.positions[0])).size).toBe(5)
  })

  it('is best-effort when there are not enough young candidates anywhere', () => {
    const { team, players } = buildTeam({ PG: [30], SG: [30], SF: [30], PF: [30], C: [30] })
    const result = applyHouseRule('youth-movement', team, players)
    expect(result.team.startingFive).toEqual(team.startingFive) // no young players exist at all -- unchanged
  })
})

describe('applyHouseRule / short-bench', () => {
  it('trims the roster to the target size, keeping all starters', () => {
    const ages: Record<Position, number[]> = {
      PG: [25, 25, 25],
      SG: [25, 25, 25],
      SF: [25, 25],
      PF: [25, 25],
      C: [25, 25],
    }
    const { team, players } = buildTeam(ages)
    const result = applyHouseRule('short-bench', team, players)

    expect(result.team.rosterPlayerIds).toHaveLength(8)
    expect(team.startingFive.every((id) => result.team.rosterPlayerIds.includes(id))).toBe(true)
  })

  it('sets cut players teamId to null rather than removing them', () => {
    const ages: Record<Position, number[]> = { PG: [25, 25, 25], SG: [25, 25, 25], SF: [25, 25], PF: [25, 25], C: [25, 25] }
    const { team, players } = buildTeam(ages)
    const result = applyHouseRule('short-bench', team, players)

    expect(result.players).toHaveLength(players.length)
    const cut = result.players.filter((p) => p.teamId === null)
    expect(cut.length).toBe(players.length - 8)
  })

  it('is a no-op when the roster is already at or below the target size', () => {
    const ages: Record<Position, number[]> = { PG: [25], SG: [25], SF: [25], PF: [25], C: [25] }
    const { team, players } = buildTeam(ages)
    const result = applyHouseRule('short-bench', team, players)
    expect(result.team.rosterPlayerIds).toEqual(team.rosterPlayerIds)
  })
})

/** Roster with an explicit quality ranking and minutes -- makeTestPlayer pins overallRating at 50,
 *  and the three new rules all read one or both of those. */
function buildRankedTeam(minutesByRank: number[]): { team: Team; players: Player[] } {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
  const players = minutesByRank.map((_, i) =>
    ({ ...makeTestPlayer({ positions: [positions[i % positions.length]] }), overallRating: 90 - i * 5 }),
  )
  const team = makeTestTeam({
    rosterPlayerIds: players.map((p) => p.id),
    startingFive: players.slice(0, 5).map((p) => p.id),
    rotationMinutes: Object.fromEntries(players.map((p, i) => [p.id, minutesByRank[i]])),
  })
  players.forEach((p) => (p.teamId = team.id))
  return { team, players }
}

describe('applyHouseRule / minutes-cap', () => {
  it('pulls anyone over the cap down to it and leaves everyone else alone', () => {
    const { team, players } = buildRankedTeam([40, 36, 30, 20, 12])
    const result = applyHouseRule('minutes-cap', team, players)
    const minutes = players.map((p) => result.team.rotationMinutes[p.id])

    expect(minutes).toEqual([30, 30, 30, 20, 12])
  })

  it('frees the minutes rather than handing them to someone else -- that is the GM decision', () => {
    const { team, players } = buildRankedTeam([40, 36, 30, 20, 12])
    const before = Object.values(team.rotationMinutes).reduce((a, b) => a + b, 0)
    const result = applyHouseRule('minutes-cap', team, players)
    const after = Object.values(result.team.rotationMinutes).reduce((a, b) => a + b, 0)

    expect(after).toBeLessThan(before)
  })

  it('exposes its cap to the minutes budget, and no other rule does', () => {
    expect(houseRuleMinutesCap('minutes-cap')).toBe(30)
    expect(houseRuleMinutesCap('short-bench')).toBeNull()
    expect(houseRuleMinutesCap('homegrown-mandate')).toBeNull()
  })
})

describe('applyHouseRule / deep-bench', () => {
  it('drops exactly the worst four to replacement level and keeps the roster full', () => {
    const { team, players } = buildRankedTeam([32, 30, 28, 24, 20, 16, 12, 10, 8, 6])
    const result = applyHouseRule('deep-bench', team, players)
    const byId = new Map(result.players.map((p) => [p.id, p]))

    expect(result.team.rosterPlayerIds).toEqual(team.rosterPlayerIds) // nobody is cut, unlike short-bench
    expect(result.players.every((p) => p.teamId === team.id)).toBe(true)

    const worstFour = new Set(players.slice(-4).map((p) => p.id))
    for (const player of players) {
      const after = byId.get(player.id)!
      if (worstFour.has(player.id)) expect(after.overallRating).toBeLessThan(player.overallRating)
      else expect(after.overallRating).toBe(player.overallRating)
    }
  })
})

describe('applyHouseRule / homegrown-mandate', () => {
  it('protects the two best players and nobody else', () => {
    const { team, players } = buildRankedTeam([32, 30, 28, 24, 20])
    const ids = houseRuleProtectedPlayerIds('homegrown-mandate', team, players)

    expect(ids).toEqual(new Set([players[0].id, players[1].id]))
    expect(houseRuleProtectedPlayerIds('short-bench', team, players).size).toBe(0)
  })

  it('leaves an already-compliant rotation untouched', () => {
    const { team, players } = buildRankedTeam([32, 30, 28, 24, 20])
    const result = applyHouseRule('homegrown-mandate', team, players)
    expect(result.team.rotationMinutes).toEqual(team.rotationMinutes)
  })

  it('raises a benched protected player to the floor, paying for it from his own position', () => {
    // Ten players, so PG holds ranks 0 and 5. The best player is parked at 4 minutes while his
    // positional backup holds 40 -- the shortfall has to come out of that backup.
    const { team, players } = buildRankedTeam([4, 30, 28, 24, 20, 40, 12, 10, 8, 6])
    const result = applyHouseRule('homegrown-mandate', team, players)

    expect(result.team.rotationMinutes[players[0].id]).toBe(HOMEGROWN_MIN_MINUTES)
    expect(result.team.rotationMinutes[players[5].id]).toBe(40 - (HOMEGROWN_MIN_MINUTES - 4))
    // The position group's total is conserved, so the floor never pushes it past its 48.
    const pgTotal = [players[0], players[5]].reduce((sum, p) => sum + result.team.rotationMinutes[p.id], 0)
    expect(pgTotal).toBe(44)
  })

  it('keeps a position inside its budget when both protected players share it', () => {
    // The case a real run threw up: the roster's two best were both PGs, generated at 32 and 16.
    // Raising the second to his floor has to come out of the first, because there is nobody else at
    // the position -- and a first cut that refused to touch a protected teammate pushed the group to
    // 52 of its 48, leaving the ceiling below the floor.
    const positions: Position[] = ['PG', 'PG', 'SG', 'SF', 'PF']
    const players = positions.map((position, i) => ({
      ...makeTestPlayer({ positions: [position] }),
      overallRating: 90 - i * 5,
    }))
    const team = makeTestTeam({
      rosterPlayerIds: players.map((p) => p.id),
      startingFive: players.map((p) => p.id),
      rotationMinutes: Object.fromEntries(players.map((p, i) => [p.id, [32, 16, 48, 48, 48][i]])),
    })
    players.forEach((p) => (p.teamId = team.id))

    const result = applyHouseRule('homegrown-mandate', team, players)
    const [best, second] = players

    expect(result.team.rotationMinutes[second.id]).toBe(HOMEGROWN_MIN_MINUTES)
    expect(result.team.rotationMinutes[best.id]).toBeGreaterThanOrEqual(HOMEGROWN_MIN_MINUTES) // donated, but not below his own floor
    expect(result.team.rotationMinutes[best.id] + result.team.rotationMinutes[second.id]).toBe(48)
  })
})

describe('applyHouseRule / ironman-rule', () => {
  it('pins every starter and nobody else', () => {
    const { team, players } = buildRankedTeam([32, 30, 28, 24, 20, 16, 12, 10])
    const ids = houseRuleProtectedPlayerIds('ironman-rule', team, players)
    expect(ids).toEqual(new Set(team.startingFive))
  })

  it('raises a starter under the floor, paying for it from his own position', () => {
    // Eight players, so PG holds ranks 0 and 5. The PG starter is parked at 10 while his backup holds
    // 38 -- one starter per position means the shortfall can only come from that backup.
    const { team, players } = buildRankedTeam([10, 30, 28, 24, 20, 38, 12, 10])
    const result = applyHouseRule('ironman-rule', team, players)

    expect(result.team.rotationMinutes[players[0].id]).toBe(30)
    expect(result.team.rotationMinutes[players[5].id]).toBe(38 - 20)
    // The position group's total is conserved, so the floor never pushes it past its 48.
    expect(result.team.rotationMinutes[players[0].id] + result.team.rotationMinutes[players[5].id]).toBe(48)
  })
})

describe('applyHouseRule / everybody-plays', () => {
  it('pins the whole roster', () => {
    const { team, players } = buildRankedTeam([32, 30, 28, 24, 20, 16, 12, 10])
    expect(houseRuleProtectedPlayerIds('everybody-plays', team, players)).toEqual(new Set(players.map((p) => p.id)))
  })

  it('lifts the deepest bench to the floor out of the starter at his position', () => {
    // PG four deep -- the worst case the roster template can produce -- with the last two below the
    // floor. Both have to come up, and the minutes can only come from the two above them.
    const positions: Position[] = ['PG', 'PG', 'PG', 'PG', 'SG', 'SF', 'PF', 'C']
    const players = positions.map((position, i) => ({ ...makeTestPlayer({ positions: [position] }), overallRating: 90 - i }))
    const team = makeTestTeam({
      rosterPlayerIds: players.map((p) => p.id),
      startingFive: [players[0].id, players[4].id, players[5].id, players[6].id, players[7].id],
      rotationMinutes: Object.fromEntries(players.map((p, i) => [p.id, [28, 11, 6, 3, 48, 48, 48, 48][i]])),
    })
    players.forEach((p) => (p.teamId = team.id))

    const result = applyHouseRule('everybody-plays', team, players)
    const pg = players.slice(0, 4).map((p) => result.team.rotationMinutes[p.id])

    expect(pg.every((m) => m >= 8)).toBe(true)
    expect(pg.reduce((a, b) => a + b, 0)).toBe(48) // conserved: nobody's floor is paid for out of thin air
  })
})

/**
 * The invariant three floor rules introduce and none of them can check alone: floors owed inside one
 * position group must fit that group's 48.
 *
 * Homegrown's constant carried this as a hand-worked comment ("two at 20 needs 40 of 48"). With three
 * rules the arithmetic is worth enforcing rather than re-deriving, and it is the specific way a new
 * floor rule would break -- silently, on the subset of rosters that happen to stack a position.
 */
describe('minutes floors fit inside every position budget', () => {
  const floorRules: HouseRuleId[] = ['homegrown-mandate', 'ironman-rule', 'everybody-plays']

  for (const ruleId of floorRules) {
    it(`${HOUSE_RULES[ruleId].label} never owes a position more than it has`, () => {
      for (let seed = 0; seed < 8; seed++) {
        const rng = createSeededRng(seed + 1)
        const { teams, players } = generateLeague({ teamCount: 8, leagueName: 'L', rng, seasonLength: 16 })
        const byId = new Map(players.map((p) => [p.id, p]))

        for (const generated of teams) {
          const roster = generated.rosterPlayerIds.map((id) => byId.get(id)!).filter(Boolean)
          const { team } = applyHouseRule(ruleId, generated, roster)

          for (const position of POSITION_ORDER) {
            const group = roster.filter((p) => p.positions[0] === position)
            const owed = group.reduce((sum, p) => sum + houseRuleMinMinutesFor(ruleId, team, roster, p.id), 0)
            expect(owed).toBeLessThanOrEqual(POSITION_MINUTES_BUDGET)

            // And seeding leaves the group inside its budget, so no floor can ever exceed the ceiling
            // maxMinutesFor derives from it -- the conflict minMinutesFor promises cannot happen.
            const assigned = group.reduce((sum, p) => sum + (team.rotationMinutes[p.id] ?? 0), 0)
            expect(assigned).toBeLessThanOrEqual(POSITION_MINUTES_BUDGET + 1e-6)
          }
        }
      }
    })
  }
})

describe('pickRandomHouseRules', () => {
  it('returns the requested count of distinct valid rule ids', () => {
    const rng = createSeededRng(9)
    for (let i = 0; i < 20; i++) {
      const picks = pickRandomHouseRules(2, rng)
      expect(picks).toHaveLength(2)
      expect(new Set(picks).size).toBe(2)
      for (const id of picks) expect(Object.keys(HOUSE_RULES)).toContain(id)
    }
  })
})
