import { describe, expect, it } from 'vitest'
import { DEFENSIVE_SCHEMES, OFFENSIVE_PLAYBOOKS } from '../data/presets'
import { BALANCED_FOCUS, type Game, type Player, type TacticalFocus } from '../data/types'
import { generateTeam } from './generator/randomTeam'
import { createSeededRng } from './rng'
import { simulateGame } from './simulateGame'
import {
  fastBreakResistanceScale,
  focusedInteriorFocus,
  focusedPlaybook,
  focusPaceEfficiency,
  focusPaceScale,
  focusForSystem,
  focusReboundOffset,
} from './tacticalFocus'

function focus(overrides: Partial<TacticalFocus>): TacticalFocus {
  return { ...BALANCED_FOCUS, ...overrides }
}

function buildMatchup(seed: number, homeFocus?: TacticalFocus) {
  const home = generateTeam({
    name: 'Home',
    city: 'Home City',
    abbreviation: 'HOM',
    primaryColor: '#000',
    secondaryColor: '#fff',
    offensiveStrategyId: 'balanced',
    defensiveStrategyId: 'manToMan',
    rng: createSeededRng(seed),
  })
  const away = generateTeam({
    name: 'Away',
    city: 'Away City',
    abbreviation: 'AWY',
    primaryColor: '#111',
    secondaryColor: '#eee',
    offensiveStrategyId: 'motion',
    defensiveStrategyId: 'manToMan',
    rng: createSeededRng(seed + 1),
  })
  const playersById = new Map<string, Player>()
  ;[...home.players, ...away.players].forEach((p) => playersById.set(p.id, p))
  return { home: { ...home.team, tacticalFocus: homeFocus }, away: away.team, playersById }
}

function emptyGame(homeTeamId: string, awayTeamId: string): Game {
  return {
    id: 'game-1',
    leagueId: 'league-1',
    homeTeamId,
    awayTeamId,
    date: '2026-01-01T00:00:00.000Z',
    isPlayed: false,
    result: null,
    possessionLog: [],
    isSaved: false,
  }
}

/** The played game *and* the teams it was played with -- generateTeam mints fresh ids each call, so
 *  a caller that rebuilt the matchup to look up an id would be reading a different team. */
function play(seed: number, homeFocus?: TacticalFocus) {
  const { home, away, playersById } = buildMatchup(seed, homeFocus)
  const game = simulateGame(emptyGame(home.id, away.id), home, away, playersById, 200, createSeededRng(seed + 500))
  return { game, home, away }
}

/** Replays one already-built matchup with a different focus on the home team, so both games share
 *  every id and the two logs can be compared outright. */
function replay(seed: number, matchup: ReturnType<typeof buildMatchup>, homeFocus?: TacticalFocus): Game {
  const home = { ...matchup.home, tacticalFocus: homeFocus }
  return simulateGame(emptyGame(home.id, matchup.away.id), home, matchup.away, matchup.playersById, 200, createSeededRng(seed + 500))
}

/** Home team's share of the possession log, and what it did with it. */
function homeShape(game: Game, homeTeamId: string) {
  const own = game.possessionLog.filter((p) => p.offenseTeamId === homeTeamId)
  return {
    possessions: own.length,
    offensiveRebounds: own.filter((p) => p.offensiveRebound).length,
    threeAttempts: own.filter((p) => p.isThreePointAttempt).length,
    postUps: own.filter((p) => p.playCallUsed === 'post-up').length,
    cuts: own.filter((p) => p.playCallUsed === 'cutting').length,
    transitions: own.filter((p) => p.playCallUsed === 'transition').length,
  }
}

describe('an absent focus and a balanced focus are the same thing', () => {
  // The guard the whole optional-field design rests on. Team.tacticalFocus is optional so old saves
  // load untouched and every existing seed, calibration figure and regression test keeps its meaning
  // -- all of which is only true if a balanced dial is a genuine no-op rather than nearly one.
  it('produces an identical game from the same seed', () => {
    for (const seed of [1, 2, 3]) {
      const matchup = buildMatchup(seed)
      const without = replay(seed, matchup, undefined)
      const balanced = replay(seed, matchup, BALANCED_FOCUS)
      expect(balanced.possessionLog).toEqual(without.possessionLog)
      expect(balanced.result).toEqual(without.result)
    }
  })

  it('and turning any single dial off balance does change it', () => {
    // The other half of the guard: if the comparison above passed because the harness never reaches
    // the dials at all, this fails too.
    //
    // Asserted across seeds rather than on one, because a dial changing nothing in a *particular*
    // game is not evidence of a dead wire. The defensive tilt moves resistance by ~15% on the play
    // calls it touches, which is ~2.7 percentage points of make probability once
    // MAKE_PROB_MARGIN_SCALE (360) divides it -- so over one game's ~85 touchable possessions,
    // flipping no outcome at all is roughly a one-in-ten coincidence, and seed 1 is one of them.
    const dials = [focus({ pace: 'push' }), focus({ shotSelection: 'threes' }), focus({ defensiveTilt: 'paint' }), focus({ glass: 'crash' })]

    for (const dial of dials) {
      const changedSomewhere = [1, 2, 3].some((seed) => {
        const matchup = buildMatchup(seed)
        return JSON.stringify(replay(seed, matchup, dial).possessionLog) !== JSON.stringify(replay(seed, matchup, BALANCED_FOCUS).possessionLog)
      })
      expect(changedSomewhere).toBe(true)
    }
  })
})

describe('focusedPlaybook', () => {
  const twinTowers = OFFENSIVE_PLAYBOOKS.twinTowers
  const paceAndSpace = OFFENSIVE_PLAYBOOKS.paceAndSpace

  it('returns the same reference when balanced, so callers can tell nothing changed', () => {
    expect(focusedPlaybook(twinTowers, BALANCED_FOCUS)).toBe(twinTowers)
    expect(focusedPlaybook(twinTowers, undefined)).toBe(twinTowers)
  })

  it('leans toward the rim without inventing a play the system does not run', () => {
    // Twin Towers lists transition at 0. Multiplying keeps it there however hard the dial is turned,
    // which is what stops a focus from overwriting the drafted system's identity.
    const leaned = focusedPlaybook(twinTowers, focus({ shotSelection: 'rim' }))
    expect(leaned.weights['post-up']).toBeGreaterThan(twinTowers.weights['post-up'])
    expect(leaned.weights['spot-up']).toBeLessThan(twinTowers.weights['spot-up'])
    expect(leaned.weights.transition).toBe(0)
  })

  it('leans the other way for threes, and spot-up is the call that actually produces one', () => {
    // playerSelector marks spot-up as the only always-outside action, so this is the play call the
    // dial has to move -- transition is a runout finished at the rim in this engine, not a trailer
    // three, which is why it moves *down* here.
    const leaned = focusedPlaybook(paceAndSpace, focus({ shotSelection: 'threes' }))
    expect(leaned.weights['spot-up']).toBeGreaterThan(paceAndSpace.weights['spot-up'])
    expect(leaned.weights.transition).toBeLessThan(paceAndSpace.weights.transition)
  })

  it('never produces a negative weight', () => {
    for (const playbook of Object.values(OFFENSIVE_PLAYBOOKS)) {
      for (const shotSelection of ['rim', 'threes'] as const) {
        const leaned = focusedPlaybook(playbook, focus({ shotSelection }))
        Object.values(leaned.weights).forEach((w) => expect(w).toBeGreaterThanOrEqual(0))
      }
    }
  })
})

describe('fastBreakResistanceScale', () => {
  it('charges a crashing team and pays a retreating one, on the same quantity', () => {
    expect(fastBreakResistanceScale(focus({ glass: 'crash' }))).toBeLessThan(1)
    expect(fastBreakResistanceScale(focus({ glass: 'getBack' }))).toBeGreaterThan(1)
  })

  it('is exactly 1 when balanced or absent, so the flag alone changes nothing', () => {
    // The whole reason isFastBreak can be set on *every* live defensive rebound rather than only
    // against a crashing offense: the situation is always tracked, and the dial alone decides what
    // it costs. If this returned anything but 1, every un-dialled game in the suite would move.
    expect(fastBreakResistanceScale(BALANCED_FOCUS)).toBe(1)
    expect(fastBreakResistanceScale(undefined)).toBe(1)
  })
})

describe('focusedInteriorFocus', () => {
  const manToMan = DEFENSIVE_SCHEMES.manToMan

  it('is the scheme value when balanced', () => {
    expect(focusedInteriorFocus(manToMan, BALANCED_FOCUS)).toBe(manToMan.interiorFocus)
    expect(focusedInteriorFocus(manToMan, undefined)).toBe(manToMan.interiorFocus)
  })

  it('moves in both directions by the same amount, which is what makes the dial cost something', () => {
    const paint = focusedInteriorFocus(manToMan, focus({ defensiveTilt: 'paint' }))
    const perimeter = focusedInteriorFocus(manToMan, focus({ defensiveTilt: 'perimeter' }))
    expect(paint - manToMan.interiorFocus).toBeCloseTo(manToMan.interiorFocus - perimeter, 10)
  })

  it('stays inside the range applyInteriorFocus was reasoned on, even on an already-extreme scheme', () => {
    const tilted = focusedInteriorFocus(DEFENSIVE_SCHEMES.packThePaint, focus({ defensiveTilt: 'paint' }))
    expect(tilted).toBeLessThanOrEqual(0.9)
    expect(focusedInteriorFocus(DEFENSIVE_SCHEMES.fullCourtPress, focus({ defensiveTilt: 'perimeter' }))).toBeGreaterThanOrEqual(0.1)
  })
})

describe('the scalar dials', () => {
  it('are all exactly neutral when balanced or absent', () => {
    for (const f of [BALANCED_FOCUS, undefined]) {
      expect(focusPaceScale(f)).toBe(1)
      expect(focusPaceEfficiency(f)).toBe(1)
      expect(focusReboundOffset(f)).toBe(0)
      expect(fastBreakResistanceScale(f)).toBe(1)
    }
  })

  it('trade volume against efficiency on pace, rather than handing out free tempo', () => {
    expect(focusPaceScale(focus({ pace: 'push' }))).toBeLessThan(1)
    expect(focusPaceEfficiency(focus({ pace: 'push' }))).toBeLessThan(1)
    expect(focusPaceScale(focus({ pace: 'control' }))).toBeGreaterThan(1)
    expect(focusPaceEfficiency(focus({ pace: 'control' }))).toBeGreaterThan(1)
  })

  it('trade second chances against getting back on the glass', () => {
    // Both directions pay in one currency and are charged in the other, which is what stops either
    // end being free: crashing buys boards and sells transition defense, getting back the reverse.
    expect(focusReboundOffset(focus({ glass: 'crash' }))).toBeGreaterThan(0)
    expect(fastBreakResistanceScale(focus({ glass: 'crash' }))).toBeLessThan(1)

    expect(focusReboundOffset(focus({ glass: 'getBack' }))).toBeLessThan(0)
    expect(fastBreakResistanceScale(focus({ glass: 'getBack' }))).toBeGreaterThan(1)
  })
})

describe('each dial moves its own quantity in a whole game', () => {
  // Seeded end-to-end rather than unit-level, because the thing worth asserting is that the offset
  // survives every layer between the dial and the possession log.
  const seeds = [11, 12, 13, 14, 15]

  function totals(homeFocus: TacticalFocus | undefined) {
    return seeds.reduce(
      (sum, seed) => {
        const { game, home } = play(seed, homeFocus)
        const shape = homeShape(game, home.id)
        return {
          possessions: sum.possessions + shape.possessions,
          offensiveRebounds: sum.offensiveRebounds + shape.offensiveRebounds,
          postUps: sum.postUps + shape.postUps,
          cuts: sum.cuts + shape.cuts,
          transitions: sum.transitions + shape.transitions,
        }
      },
      { possessions: 0, offensiveRebounds: 0, postUps: 0, cuts: 0, transitions: 0 },
    )
  }

  const balanced = totals(undefined)

  it('pushing the pace produces more possessions, controlling it fewer', () => {
    expect(totals(focus({ pace: 'push' })).possessions).toBeGreaterThan(balanced.possessions)
    expect(totals(focus({ pace: 'control' })).possessions).toBeLessThan(balanced.possessions)
  })

  it('crashing the glass produces more offensive rebounds, getting back fewer', () => {
    expect(totals(focus({ glass: 'crash' })).offensiveRebounds).toBeGreaterThan(balanced.offensiveRebounds)
    expect(totals(focus({ glass: 'getBack' })).offensiveRebounds).toBeLessThan(balanced.offensiveRebounds)
  })

  it('attacking the rim shifts the play mix toward the rim', () => {
    // A share, not a count. The dial scales play-call *weights* (focusedPlaybook), so the mix is the
    // quantity it controls; the number of plays in a game is set by pace and by how many misses come
    // back as second chances, neither of which the dial is aiming at. Counting post-ups outright made
    // this test a proxy for shooting percentage -- once rim attacks started converting like rim
    // attacks, a rim-leaning team missed less, got fewer second chances, and ran *fewer* total plays,
    // so 97 post-ups became 95 while the share of its offense going to the post went up.
    //
    // Post-up and cutting together, because RIM_LEAN boosts both at 1 -- post-ups alone measure half
    // of what the dial does.
    const rimShare = (t: ReturnType<typeof totals>) => (t.postUps + t.cuts) / t.possessions
    expect(rimShare(totals(focus({ shotSelection: 'rim' })))).toBeGreaterThan(rimShare(balanced))
    expect(rimShare(totals(focus({ shotSelection: 'threes' })))).toBeLessThan(rimShare(balanced))
  })

  it('crashing costs points off live rebounds, which is what pays for the extra boards', () => {
    // The cost side of the Crash dial, measured where it is actually charged: what the opponent
    // scores on the possession immediately after one of our misses turns over live.
    //
    // Per possession, not in total. Crashing also *wins* more of those boards, so it leaves the
    // opponent fewer of them to score on -- measuring the total nets the cost against the benefit
    // and reads as no effect at all, which is what the first version of this test did.
    const pointsPerLiveBoard = (homeFocus: TacticalFocus | undefined) => {
      let points = 0
      let possessions = 0
      for (const seed of seeds) {
        const { game, home, away } = play(seed, homeFocus)
        game.possessionLog.forEach((entry, i) => {
          const previous = game.possessionLog[i - 1]
          const followsOurLostBoard =
            previous?.offenseTeamId === home.id && previous.outcome === 'miss' && !previous.offensiveRebound
          if (entry.offenseTeamId === away.id && followsOurLostBoard) {
            points += entry.pointsScored
            possessions += 1
          }
        })
      }
      return points / possessions
    }

    expect(pointsPerLiveBoard(focus({ glass: 'crash' }))).toBeGreaterThan(pointsPerLiveBoard(focus({ glass: 'getBack' })))
  })
})

describe('focusForSystem', () => {
  it('gives a lopsided system dials that agree with its identity', () => {
    // The point of deriving rather than rolling: a scouting report that says "7 Seconds or Less,
    // pushing the tempo" reads as a team, where "Twin Towers, hunting threes" reads as a bug.
    expect(focusForSystem('sevenSecondsOrLess')).toMatchObject({ pace: 'push', shotSelection: 'threes' })
    expect(focusForSystem('twinTowers')).toMatchObject({ pace: 'control', shotSelection: 'rim' })
    expect(focusForSystem('gritAndGrind')).toMatchObject({ pace: 'control', shotSelection: 'rim' })
  })

  it('leaves a system with no particular lean balanced', () => {
    // Most of the league, deliberately -- a lean that everyone has says nothing.
    expect(focusForSystem('balanced')).toBeUndefined()
    expect(focusForSystem('motion')).toBeUndefined()
    expect(focusForSystem('not-a-real-system')).toBeUndefined()
  })

  it('is what generateTeam hands an AI team', () => {
    const built = generateTeam({
      name: 'T', city: 'C', abbreviation: 'TTT', primaryColor: '#000', secondaryColor: '#fff',
      offensiveStrategyId: 'twinTowers', defensiveStrategyId: 'manToMan', rng: createSeededRng(1),
    })
    expect(built.team.tacticalFocus).toEqual(focusForSystem('twinTowers'))
  })
})
