import { describe, expect, it } from 'vitest'
import type { Player, PlayerId, Position, Team } from '../../data/types'
import { makeTestPlayer, makeTestTeam } from '../testFixtures'
import {
  FATIGUE_EMERGENCY_THRESHOLD,
  FATIGUE_SUB_IN_MAX,
  FATIGUE_SUB_OUT_THRESHOLD,
  MIN_SHIFT_SECONDS,
  PACE_CHECK_MIN_SECONDS,
} from '../constants'
import { slotByPosition } from '../matchup'
import { checkSubstitutions, rotationValue } from './substitution'
import type { RotationState } from './rotationState'

function buildFixture(opts: {
  starterFatigue?: number
  benchFatigue?: number
  rotationMinutes?: Record<PlayerId, number>
  secondsPlayed?: number
  shiftEnteredAtSeconds?: number
}) {
  const starter = makeTestPlayer({ positions: ['PG'], name: 'Starter' })
  const bench = makeTestPlayer({ positions: ['PG'], name: 'Bench' })
  const offPosition = makeTestPlayer({ positions: ['C'], name: 'WrongPosition' })

  const team: Team = makeTestTeam({
    rosterPlayerIds: [starter.id, bench.id, offPosition.id],
    startingFive: [starter.id],
    rotationMinutes: opts.rotationMinutes ?? { [starter.id]: 32, [bench.id]: 16, [offPosition.id]: 20 },
  })

  const playersById = new Map<PlayerId, Player>([
    [starter.id, starter],
    [bench.id, bench],
    [offPosition.id, offPosition],
  ])

  const state: RotationState = {
    onCourt: slotByPosition([starter]),
    fatigue: new Map([
      [starter.id, opts.starterFatigue ?? 0],
      [bench.id, opts.benchFatigue ?? 0],
      [offPosition.id, 0],
    ]),
    secondsPlayed: new Map([
      [starter.id, opts.secondsPlayed ?? 0],
      [bench.id, 0],
      [offPosition.id, 0],
    ]),
    shiftEnteredAtSeconds: new Map([[starter.id, opts.shiftEnteredAtSeconds ?? 0]]),
  }

  return { starter, bench, offPosition, team, playersById, state }
}

describe('checkSubstitutions', () => {
  it('does not sub even at high fatigue before MIN_SHIFT_SECONDS has elapsed', () => {
    const { starter, state, team, playersById } = buildFixture({
      starterFatigue: 90,
      benchFatigue: 0,
      shiftEnteredAtSeconds: 0,
    })
    checkSubstitutions(state, team, [], playersById, MIN_SHIFT_SECONDS - 1, 1, MIN_SHIFT_SECONDS - 1)
    expect(state.onCourt[0].player).toBe(starter)
  })

  it('subs out at the fatigue threshold once past the cooldown, bringing in the rested bench player', () => {
    const { bench, state, team, playersById } = buildFixture({
      starterFatigue: FATIGUE_SUB_OUT_THRESHOLD,
      benchFatigue: 0,
      shiftEnteredAtSeconds: 0,
    })
    checkSubstitutions(state, team, [], playersById, MIN_SHIFT_SECONDS + 1, 1, MIN_SHIFT_SECONDS + 1)
    expect(state.onCourt[0].player).toBe(bench)
  })

  it('hands the slot to the incoming player rather than re-deriving it from him', () => {
    // The slot is the assignment, not a property of whoever happens to be filling it. Today the
    // replacement's own position always matches anyway; this pins the direction of the dependency
    // so free-form lineups can relax the candidate filter without the slot drifting with it.
    const { state, team, playersById } = buildFixture({
      starterFatigue: FATIGUE_SUB_OUT_THRESHOLD,
      benchFatigue: 0,
      shiftEnteredAtSeconds: 0,
    })
    const slotBefore = state.onCourt[0].slot

    checkSubstitutions(state, team, [], playersById, MIN_SHIFT_SECONDS + 1, 1, MIN_SHIFT_SECONDS + 1)

    expect(state.onCourt[0].slot).toBe(slotBefore)
  })

  it('the emergency threshold bypasses the shift cooldown', () => {
    const { bench, state, team, playersById } = buildFixture({
      starterFatigue: FATIGUE_EMERGENCY_THRESHOLD,
      benchFatigue: 0,
      shiftEnteredAtSeconds: 0,
    })
    checkSubstitutions(state, team, [], playersById, 1, 1, 1) // well within the normal cooldown window
    expect(state.onCourt[0].player).toBe(bench)
  })

  it('leaves the outgoing player in if every same-position bench player is also too tired', () => {
    const { starter, state, team, playersById } = buildFixture({
      starterFatigue: FATIGUE_SUB_OUT_THRESHOLD,
      benchFatigue: FATIGUE_SUB_IN_MAX + 1,
      shiftEnteredAtSeconds: 0,
    })
    checkSubstitutions(state, team, [], playersById, MIN_SHIFT_SECONDS + 1, 1, MIN_SHIFT_SECONDS + 1)
    expect(state.onCourt[0].player).toBe(starter)
  })

  it('never selects a cross-position bench player even if more rested', () => {
    // offPosition (C) is rested and high quality, but starter is PG -- must not be selected
    const { starter, offPosition, bench, state, team, playersById } = buildFixture({
      starterFatigue: FATIGUE_SUB_OUT_THRESHOLD,
      benchFatigue: FATIGUE_SUB_IN_MAX + 1, // the only same-position bench player is too tired
      shiftEnteredAtSeconds: 0,
    })
    checkSubstitutions(state, team, [], playersById, MIN_SHIFT_SECONDS + 1, 1, MIN_SHIFT_SECONDS + 1)
    expect(state.onCourt[0].player).not.toBe(offPosition)
    expect(state.onCourt[0].player).toBe(starter) // falls back to "stays in", not the wrong-position player
    expect(state.onCourt[0].player).not.toBe(bench)
  })

  it('triggers a pace-overage sub for a low-target-minutes player running ahead of pace, even below the fatigue threshold', () => {
    const { bench, state, team, playersById } = buildFixture({
      starterFatigue: 10, // well below FATIGUE_SUB_OUT_THRESHOLD
      benchFatigue: 0,
      rotationMinutes: undefined,
      secondsPlayed: 240, // on court for every second elapsed so far -- way over any reasonable target
      shiftEnteredAtSeconds: 0,
    })
    // give the starter a small target so their pace is clearly over
    team.rotationMinutes[state.onCourt[0].player.id] = 5 // 5/48 target share, against a 240/240 actual
    checkSubstitutions(state, team, [], playersById, 240, 1, 240)
    expect(state.onCourt[0].player).toBe(bench)
  })

  it('skips the pace check entirely before PACE_CHECK_MIN_SECONDS', () => {
    const { starter, state, team, playersById } = buildFixture({
      starterFatigue: 0,
      secondsPlayed: 5,
      shiftEnteredAtSeconds: 0,
    })
    team.rotationMinutes[starter.id] = 1 // tiny target, would trigger pace overage if checked
    checkSubstitutions(state, team, [], playersById, PACE_CHECK_MIN_SECONDS - 1, 1, PACE_CHECK_MIN_SECONDS - 1)
    expect(state.onCourt[0].player).toBe(starter)
  })

  it('does not double-book a bench player across two simultaneous outgoing slots', () => {
    const starter1 = makeTestPlayer({ positions: ['PG'], name: 'Starter1' })
    const starter2 = makeTestPlayer({ positions: ['PG'], name: 'Starter2' }) // same position, unusual but exercises the guard
    const onlyBench = makeTestPlayer({ positions: ['PG'], name: 'OnlyBench' })

    const team = makeTestTeam({
      rosterPlayerIds: [starter1.id, starter2.id, onlyBench.id],
      startingFive: [starter1.id, starter2.id],
      rotationMinutes: { [starter1.id]: 32, [starter2.id]: 32, [onlyBench.id]: 16 },
    })
    const playersById = new Map<PlayerId, Player>([
      [starter1.id, starter1],
      [starter2.id, starter2],
      [onlyBench.id, onlyBench],
    ])
    const state: RotationState = {
      onCourt: slotByPosition([starter1, starter2]),
      fatigue: new Map([
        [starter1.id, FATIGUE_SUB_OUT_THRESHOLD],
        [starter2.id, FATIGUE_SUB_OUT_THRESHOLD],
        [onlyBench.id, 0],
      ]),
      secondsPlayed: new Map([
        [starter1.id, 0],
        [starter2.id, 0],
        [onlyBench.id, 0],
      ]),
      shiftEnteredAtSeconds: new Map([
        [starter1.id, 0],
        [starter2.id, 0],
      ]),
    }

    checkSubstitutions(state, team, [], playersById, MIN_SHIFT_SECONDS + 1, 1, MIN_SHIFT_SECONDS + 1)

    const onCourtIds = state.onCourt.map((entry) => entry.player.id)
    expect(new Set(onCourtIds).size).toBe(2) // no duplicate
    expect(onCourtIds).toContain(onlyBench.id) // one slot got the only candidate
  })

  describe('with a rotation chart (rotation-charts.md Phase F)', () => {
    it('brings in the charted player even though the fatigue heuristic alone would leave the starter in', () => {
      const { bench, state, team, playersById } = buildFixture({
        starterFatigue: 0, // nowhere near any sub-out threshold
        benchFatigue: 0,
        shiftEnteredAtSeconds: 0,
      })
      team.rotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'player', playerId: bench.id } }] } }

      checkSubstitutions(state, team, [], playersById, 100, 1, 100)

      expect(state.onCourt[0].player).toBe(bench)
      expect(state.onCourt[0].slot).toBe('PG')
      expect(state.shiftEnteredAtSeconds.get(bench.id)).toBe(100)
    })

    it('keeps a charted player in while merely tired, short of the emergency threshold', () => {
      const { starter, state, team, playersById } = buildFixture({
        starterFatigue: FATIGUE_SUB_OUT_THRESHOLD,
        benchFatigue: 0,
        shiftEnteredAtSeconds: 0,
      })
      team.rotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'player', playerId: starter.id } }] } }

      checkSubstitutions(state, team, [], playersById, 500, 1, 500)

      expect(state.onCourt[0].player).toBe(starter)
    })

    it('deviates from the chart once the charted player is actually exhausted (rotation-charts.md Phase H)', () => {
      const { starter, bench, state, team, playersById } = buildFixture({
        starterFatigue: FATIGUE_EMERGENCY_THRESHOLD,
        benchFatigue: 0,
        shiftEnteredAtSeconds: 0,
      })
      team.rotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'player', playerId: starter.id } }] } }

      checkSubstitutions(state, team, [], playersById, 500, 1, 500)

      expect(state.onCourt[0].player).toBe(bench)
    })

    it('the deviation persists through recovery until the charted player is actually rested enough, then resumes', () => {
      const { starter, bench, state, team, playersById } = buildFixture({
        starterFatigue: FATIGUE_EMERGENCY_THRESHOLD,
        benchFatigue: 0,
        shiftEnteredAtSeconds: 0,
      })
      team.rotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'player', playerId: starter.id } }] } }

      // Moment 1: starter is exhausted -- deviates, bench comes in.
      checkSubstitutions(state, team, [], playersById, 100, 1, 100)
      expect(state.onCourt[0].player).toBe(bench)

      // Moment 2: starter has recovered some off the bench, but only into the hysteresis band
      // (still above FATIGUE_SUB_OUT_THRESHOLD) -- the chart does not yank bench back out for
      // someone still nearly as gassed as when they left. Bench's own fatigue is untouched and low,
      // so the ordinary heuristic (which this now falls through to) has no reason to move either.
      state.fatigue.set(starter.id, FATIGUE_SUB_OUT_THRESHOLD + 1)
      checkSubstitutions(state, team, [], playersById, 200, 1, 200)
      expect(state.onCourt[0].player).toBe(bench)

      // Moment 3: starter has actually recovered to the resume threshold -- the chart takes back over.
      state.fatigue.set(starter.id, FATIGUE_SUB_OUT_THRESHOLD)
      checkSubstitutions(state, team, [], playersById, 300, 1, 300)
      expect(state.onCourt[0].player).toBe(starter)
    })

    it('falls through to the fatigue heuristic for an explicit auto segment', () => {
      const { bench, state, team, playersById } = buildFixture({
        starterFatigue: FATIGUE_SUB_OUT_THRESHOLD,
        benchFatigue: 0,
        shiftEnteredAtSeconds: 0,
      })
      team.rotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'auto' } }] } }

      checkSubstitutions(state, team, [], playersById, MIN_SHIFT_SECONDS + 1, 1, MIN_SHIFT_SECONDS + 1)

      expect(state.onCourt[0].player).toBe(bench) // ordinary fatigue-driven sub, unaffected by the plan
    })

    it('falls through to the fatigue heuristic outside any charted segment for this period', () => {
      const { bench, state, team, playersById } = buildFixture({
        starterFatigue: FATIGUE_SUB_OUT_THRESHOLD,
        benchFatigue: 0,
        shiftEnteredAtSeconds: 0,
      })
      // Chart only says something for period 2; period 1 has no entry at all.
      team.rotationPlan = { 2: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'player', playerId: bench.id } }] } }

      checkSubstitutions(state, team, [], playersById, MIN_SHIFT_SECONDS + 1, 1, MIN_SHIFT_SECONDS + 1)

      expect(state.onCourt[0].player).toBe(bench) // reached the same way, but via the heuristic, not the chart
    })

    /**
     * The editor flags a double-booked chart in red but doesn't block saving one, so an
     * unsatisfiable plan reaches the engine intact. Honoring it slot-by-slot used to seat one
     * player twice: four bodies on the floor, and deriveBoxScore counting the duplicate's minutes
     * once per slot -- which then flowed into season development.
     */
    describe('with an unsatisfiable chart', () => {
      /** A full five, each at their own position, plus a rested bench player per given position. */
      function buildFiveFixture(benchPositions: Position[] = [], benchFatigue = 0) {
        const five = (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).map((position) =>
          makeTestPlayer({ positions: [position], name: position }),
        )
        const substitutes = benchPositions.map((position) => makeTestPlayer({ positions: [position], name: `Bench${position}` }))
        const roster = [...five, ...substitutes]

        const team = makeTestTeam({
          rosterPlayerIds: roster.map((p) => p.id),
          startingFive: five.map((p) => p.id),
          rotationMinutes: Object.fromEntries(roster.map((p) => [p.id, 24])),
        })
        const playersById = new Map<PlayerId, Player>(roster.map((p) => [p.id, p]))
        const state: RotationState = {
          onCourt: slotByPosition(five),
          fatigue: new Map(roster.map((p) => [p.id, substitutes.includes(p) ? benchFatigue : 0])),
          secondsPlayed: new Map(roster.map((p) => [p.id, 0])),
          shiftEnteredAtSeconds: new Map(five.map((p) => [p.id, 0])),
        }

        const [pg, sg] = five
        return { five, pg, sg, substitutes, roster, team, playersById, state }
      }

      const wholePeriod = (playerId: PlayerId) => [
        { startSeconds: 0, endSeconds: 720, fill: { kind: 'player' as const, playerId } },
      ]

      it('seats a player charted into two slots at once only once, leaving the losing slot to the heuristic', () => {
        const { pg, sg, team, playersById, state } = buildFiveFixture()
        team.rotationPlan = { 1: { PG: wholePeriod(pg.id), SG: wholePeriod(pg.id) } }

        checkSubstitutions(state, team, [], playersById, 100, 1, 100)

        const onCourtIds = state.onCourt.map((entry) => entry.player.id)
        expect(new Set(onCourtIds).size).toBe(5) // five real bodies, not four and a duplicate
        // The first slot to ask for him in POSITION_ORDER wins; SG falls through to the heuristic,
        // which has no reason to move its perfectly rested incumbent.
        expect(state.onCourt[0].player).toBe(pg)
        expect(state.onCourt[1].player).toBe(sg)
      })

      it('refills a slot whose occupant an earlier charted slot took', () => {
        const { pg, sg, substitutes, team, playersById, state } = buildFiveFixture(['SG'])
        // The native SG is charted into the PG slot, and nothing is charted at SG -- so the SG slot
        // is vacated mid-loop and has to be refilled even though its (departed) occupant was rested.
        team.rotationPlan = { 1: { PG: wholePeriod(sg.id) } }

        checkSubstitutions(state, team, [], playersById, 100, 1, 100)

        const onCourtIds = state.onCourt.map((entry) => entry.player.id)
        expect(new Set(onCourtIds).size).toBe(5)
        expect(state.onCourt[0].player).toBe(sg) // chart honored
        expect(state.onCourt[1].player).toBe(substitutes[0]) // vacated slot backfilled from the bench
        expect(onCourtIds).not.toContain(pg.id) // the charted slot's own incumbent is the one who sits
      })

      it('backfills a vacated slot from a tired bench player rather than leaving the five short', () => {
        // The only same-position substitute is past FATIGUE_SUB_IN_MAX, so an ordinary sub would
        // decline him and leave the outgoing player in -- not an option here, since that player is
        // already standing in another slot.
        const { sg, substitutes, team, playersById, state } = buildFiveFixture(['SG'], FATIGUE_SUB_IN_MAX + 1)
        team.rotationPlan = { 1: { PG: wholePeriod(sg.id) } }

        checkSubstitutions(state, team, [], playersById, 100, 1, 100)

        expect(new Set(state.onCourt.map((entry) => entry.player.id)).size).toBe(5)
        expect(state.onCourt[1].player).toBe(substitutes[0])
      })

      it('lets a second slot have a charted player the first slot declined on emergency fatigue', () => {
        // Phase H's deviation and the double-book guard have to compose: an exhausted charted player
        // isn't seated at PG, and that non-assignment must not count as claiming him against SG.
        const { pg, team, playersById, state } = buildFiveFixture(['PG'])
        state.fatigue.set(pg.id, FATIGUE_EMERGENCY_THRESHOLD)
        team.rotationPlan = { 1: { PG: wholePeriod(pg.id), SG: wholePeriod(pg.id) } }

        checkSubstitutions(state, team, [], playersById, 500, 1, 500)

        // Neither slot seats him -- SG's claim is refused on the same exhaustion, not on the
        // double-book -- and the five stays five.
        expect(new Set(state.onCourt.map((entry) => entry.player.id)).size).toBe(5)
        expect(state.onCourt.map((entry) => entry.player.id)).not.toContain(pg.id)
      })

      it('ignores a charted player who is not on this roster', () => {
        const { five, team, playersById, state } = buildFiveFixture()
        team.rotationPlan = { 1: { PG: wholePeriod('no-such-player') } }

        checkSubstitutions(state, team, [], playersById, 100, 1, 100)

        expect(state.onCourt.map((entry) => entry.player)).toEqual(five)
      })
    })

    it('does not touch a slot whose charted occupant is already correct', () => {
      const { starter, state, team, playersById } = buildFixture({
        starterFatigue: 0,
        benchFatigue: 0,
        shiftEnteredAtSeconds: 0,
      })
      team.rotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'player', playerId: starter.id } }] } }

      checkSubstitutions(state, team, [], playersById, 100, 1, 100)

      expect(state.onCourt[0].player).toBe(starter)
      // Untouched -- still whatever buildFixture seeded, not bumped to 100 by a no-op "swap".
      expect(state.shiftEnteredAtSeconds.get(starter.id)).toBe(0)
    })
  })
})

describe('rotationValue', () => {
  it('prefers the better perimeter defender when the opponent is a stronger outside shooter', () => {
    const perimeterSpecialist = makeTestPlayer({
      attributes: { lateralQuickness: 90, perimeterDefense: 90, interiorDefense: 40, vertical: 40 },
    })
    const interiorSpecialist = makeTestPlayer({
      attributes: { lateralQuickness: 40, perimeterDefense: 40, interiorDefense: 90, vertical: 90 },
    })
    const perimeterOpponent = makeTestPlayer({ attributes: { outsideShot: 90, insideShot: 20 } })

    expect(rotationValue(perimeterSpecialist, perimeterOpponent)).toBeGreaterThan(
      rotationValue(interiorSpecialist, perimeterOpponent),
    )
  })

  it('prefers the better interior defender when the opponent is a stronger inside scorer', () => {
    const perimeterSpecialist = makeTestPlayer({
      attributes: { lateralQuickness: 90, perimeterDefense: 90, interiorDefense: 40, vertical: 40 },
    })
    const interiorSpecialist = makeTestPlayer({
      attributes: { lateralQuickness: 40, perimeterDefense: 40, interiorDefense: 90, vertical: 90 },
    })
    const interiorOpponent = makeTestPlayer({ attributes: { outsideShot: 20, insideShot: 90 } })

    expect(rotationValue(interiorSpecialist, interiorOpponent)).toBeGreaterThan(
      rotationValue(perimeterSpecialist, interiorOpponent),
    )
  })

  it('a clearly higher-quality candidate beats a marginally-better-matchup one', () => {
    const starPlayer = makeTestPlayer({
      attributes: {
        insideShot: 90,
        outsideShot: 90,
        passing: 90,
        ballHandling: 90,
        rebounding: 90,
        perimeterDefense: 60,
        interiorDefense: 60,
        speed: 90,
        lateralQuickness: 60,
        vertical: 90,
      },
    })
    const marginalDefender = makeTestPlayer({
      attributes: { lateralQuickness: 65, perimeterDefense: 65 }, // slightly better perimeter fit, much lower overall
    })
    const opponent = makeTestPlayer({ attributes: { outsideShot: 90, insideShot: 20 } })

    expect(rotationValue(starPlayer, opponent)).toBeGreaterThan(rotationValue(marginalDefender, opponent))
  })

  it('falls back to raw quality with no opponent to defend', () => {
    const player = makeTestPlayer()
    expect(rotationValue(player, undefined)).toBeCloseTo(50, 5) // all-default attributes average to 50
  })
})
