import { describe, expect, it } from 'vitest'
import type { Game, Player, PlayerId, PossessionLogEntry } from '../../data/types'
import { generateTeam } from '../generator/randomTeam'
import { createSeededRng } from '../rng'
import { simulateGame } from '../simulateGame'
import { makeOnCourt, makeTestPlayer, makeTestTeam } from '../testFixtures'
import { generateCoachingInsights } from './generateCoachingInsights'

function playersMap(players: Player[]): Map<PlayerId, Player> {
  return new Map(players.map((p) => [p.id, p]))
}

describe('generateCoachingInsights', () => {
  it('flags a weak-link defender who gets repeatedly targeted while their team runs a weak-link-sensitive scheme', () => {
    const weakDefender = makeTestPlayer({
      name: 'Weak Defender',
      attributes: { lateralQuickness: 10, perimeterDefense: 10 },
    })
    const strongDefenders = [
      makeTestPlayer({ name: 'D2' }),
      makeTestPlayer({ name: 'D3' }),
      makeTestPlayer({ name: 'D4' }),
      makeTestPlayer({ name: 'D5' }),
    ]
    const defenseFive = [weakDefender, ...strongDefenders]
    const attacker = makeTestPlayer({ name: 'Attacker' })

    const homeTeam = makeTestTeam({
      defensiveStrategyId: 'switchEverything',
      rosterPlayerIds: defenseFive.map((p) => p.id),
    })
    const awayTeam = makeTestTeam({
      defensiveStrategyId: 'manToMan',
      rosterPlayerIds: [attacker.id],
    })
    const playersById = playersMap([...defenseFive, attacker])

    const possessionLog: PossessionLogEntry[] = Array.from({ length: 4 }, (_, i) => ({
      possessionNumber: i + 1,
      period: 1,
      clockSecondsRemaining: 700,
      durationSeconds: 20,
      offenseTeamId: awayTeam.id,
      playCallUsed: 'pick-and-roll',
      primaryPlayerId: attacker.id,
      secondaryPlayerIds: [],
      outcome: 'make',
      pointsScored: 2,
      isThreePointAttempt: false,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      offensiveRebound: false,
      isSecondChance: false,
      playersInvolved: [],
      homeOnCourt: makeOnCourt(defenseFive.map((p) => p.id)),
      awayOnCourt: makeOnCourt([attacker.id]),
    }))

    const insights = generateCoachingInsights(possessionLog, homeTeam, awayTeam, playersById)

    expect(insights.some((i) => i.text.includes('Weak Defender') && i.text.includes('8 points'))).toBe(true)
    // The weak link is on the defending (home) team -- the insight must be tagged accordingly, not
    // the attacking away team, so a caller can filter to "insights about my own team" correctly.
    const matchupInsight = insights.find((i) => i.text.includes('Weak Defender'))
    expect(matchupInsight?.teamId).toBe(homeTeam.id)
  })

  it('does not flag a matchup insight for a non-weak-link-sensitive scheme, even with the same targeting pattern', () => {
    const weakDefender = makeTestPlayer({
      name: 'Weak Defender',
      attributes: { lateralQuickness: 10, perimeterDefense: 10 },
    })
    const strongDefenders = [makeTestPlayer(), makeTestPlayer(), makeTestPlayer(), makeTestPlayer()]
    const defenseFive = [weakDefender, ...strongDefenders]
    const attacker = makeTestPlayer()

    const homeTeam = makeTestTeam({
      defensiveStrategyId: 'manToMan',
      rosterPlayerIds: defenseFive.map((p) => p.id),
    })
    const awayTeam = makeTestTeam({ defensiveStrategyId: 'manToMan', rosterPlayerIds: [attacker.id] })
    const playersById = playersMap([...defenseFive, attacker])

    const possessionLog: PossessionLogEntry[] = Array.from({ length: 6 }, (_, i) => ({
      possessionNumber: i + 1,
      period: 1,
      clockSecondsRemaining: 700,
      durationSeconds: 20,
      offenseTeamId: awayTeam.id,
      playCallUsed: 'pick-and-roll',
      primaryPlayerId: attacker.id,
      secondaryPlayerIds: [],
      outcome: 'make',
      pointsScored: 2,
      isThreePointAttempt: false,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      offensiveRebound: false,
      isSecondChance: false,
      playersInvolved: [],
      homeOnCourt: makeOnCourt(defenseFive.map((p) => p.id)),
      awayOnCourt: makeOnCourt([attacker.id]),
    }))

    const insights = generateCoachingInsights(possessionLog, homeTeam, awayTeam, playersById)

    expect(insights.some((i) => i.text.includes('picked on'))).toBe(false)
  })

  it('flags a fatigue-driven substitution once a continuously-playing starter crosses the sub-out threshold', () => {
    const starter = makeTestPlayer({ name: 'Starter' })
    const bench = makeTestPlayer({ name: 'Bench' })
    const dummy = makeTestPlayer({ name: 'Dummy' })

    const homeTeam = makeTestTeam({ rosterPlayerIds: [starter.id, bench.id] })
    const awayTeam = makeTestTeam({ rosterPlayerIds: [dummy.id] })
    const playersById = playersMap([starter, bench, dummy])

    // 28 x 20s = 560 game seconds at 0.156 fatigue/s -> ~87 at default durability, comfortably over
    // FATIGUE_SUB_OUT_THRESHOLD (80) and under FATIGUE_EMERGENCY_THRESHOLD (95).
    const onCourtPossessions = 28
    const possessionLog: PossessionLogEntry[] = []
    for (let i = 0; i < onCourtPossessions; i++) {
      possessionLog.push({
        possessionNumber: i + 1,
        period: 1,
        clockSecondsRemaining: 700,
        durationSeconds: 20,
        offenseTeamId: awayTeam.id,
        playCallUsed: 'isolation',
        primaryPlayerId: dummy.id,
        secondaryPlayerIds: [],
        outcome: 'miss',
        pointsScored: 0,
        isThreePointAttempt: false,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        offensiveRebound: false,
        isSecondChance: false,
        playersInvolved: [],
        homeOnCourt: makeOnCourt([starter.id]),
        awayOnCourt: makeOnCourt([dummy.id]),
      })
    }
    possessionLog.push({
      possessionNumber: onCourtPossessions + 1,
      period: 1,
      clockSecondsRemaining: 700,
      durationSeconds: 20,
      offenseTeamId: awayTeam.id,
      playCallUsed: 'isolation',
      primaryPlayerId: dummy.id,
      secondaryPlayerIds: [],
      outcome: 'miss',
      pointsScored: 0,
      isThreePointAttempt: false,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      offensiveRebound: false,
      isSecondChance: false,
      playersInvolved: [],
      homeOnCourt: makeOnCourt([bench.id]),
      awayOnCourt: makeOnCourt([dummy.id]),
    })

    const insights = generateCoachingInsights(possessionLog, homeTeam, awayTeam, playersById)

    expect(
      insights.some(
        (i) => i.text.includes('Starter') && i.text.includes('Bench') && i.text.includes('heavy fatigue'),
      ),
    ).toBe(true)
    // The substitution happened on the home team (Starter/Bench are both on homeTeam's roster).
    const fatigueInsight = insights.find((i) => i.text.includes('heavy fatigue'))
    expect(fatigueInsight?.teamId).toBe(homeTeam.id)
  })

  it('produces at least one fatigue insight over a real, fully-simulated game long enough to force natural substitutions', () => {
    const home = generateTeam({
      name: 'Home',
      city: 'Home City',
      abbreviation: 'HOM',
      primaryColor: '#000',
      secondaryColor: '#fff',
      offensiveStrategyId: 'motion',
      defensiveStrategyId: 'manToMan',
      rng: createSeededRng(70),
    })
    const away = generateTeam({
      name: 'Away',
      city: 'Away City',
      abbreviation: 'AWY',
      primaryColor: '#111',
      secondaryColor: '#eee',
      offensiveStrategyId: 'isoHeavy',
      defensiveStrategyId: 'switchEverything',
      rng: createSeededRng(71),
    })
    const playersById = playersMap([...home.players, ...away.players])
    const game: Game = {
      id: 'game-1',
      leagueId: 'league-1',
      homeTeamId: home.team.id,
      awayTeamId: away.team.id,
      date: new Date().toISOString(),
      isPlayed: false,
      result: null,
      possessionLog: [],
      isSaved: false,
    }
    const possessionsPerGame = 100
    const simulated = simulateGame(game, home.team, away.team, playersById, possessionsPerGame, createSeededRng(72))

    const insights = generateCoachingInsights(simulated.possessionLog, home.team, away.team, playersById)

    expect(insights.some((i) => i.text.includes('heavy fatigue'))).toBe(true)
  })

  it('is deterministic given the same possession log', () => {
    const starter = makeTestPlayer({ name: 'Starter' })
    const bench = makeTestPlayer({ name: 'Bench' })
    const dummy = makeTestPlayer({ name: 'Dummy' })
    const homeTeam = makeTestTeam({ rosterPlayerIds: [starter.id, bench.id] })
    const awayTeam = makeTestTeam({ rosterPlayerIds: [dummy.id] })
    const playersById = playersMap([starter, bench, dummy])

    const possessionLog: PossessionLogEntry[] = Array.from({ length: 21 }, (_, i) => ({
      possessionNumber: i + 1,
      period: 1,
      clockSecondsRemaining: 700,
      durationSeconds: 20,
      offenseTeamId: awayTeam.id,
      playCallUsed: 'isolation',
      primaryPlayerId: dummy.id,
      secondaryPlayerIds: [],
      outcome: 'miss',
      pointsScored: 0,
      isThreePointAttempt: false,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      offensiveRebound: false,
      isSecondChance: false,
      playersInvolved: [],
      homeOnCourt: makeOnCourt([i < 20 ? starter.id : bench.id]),
      awayOnCourt: makeOnCourt([dummy.id]),
    }))

    const a = generateCoachingInsights(possessionLog, homeTeam, awayTeam, playersById)
    const b = generateCoachingInsights(possessionLog, homeTeam, awayTeam, playersById)
    expect(a).toEqual(b)
  })
})
