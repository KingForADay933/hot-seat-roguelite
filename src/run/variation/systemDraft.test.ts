import { describe, expect, it } from 'vitest'
import { PERIOD_SECONDS, SYNERGY_NEUTRAL } from '../../engine/constants'
import { OFFENSIVE_PLAYBOOKS } from '../../data/presets'
import { createSeededRng } from '../../engine/rng'
import { makeTestPlayer } from '../../engine/testFixtures'
import type { SystemId } from '../../data/presets'
import type { PlayerId, Position, RotationPlan, RotationSegment } from '../../data/types'
import { CHARTABLE_PERIODS } from '../rotationChart'
import {
  computeInitialSynergyScore,
  computePlayerSystemAffinity,
  computeProjectedUsageShares,
  computeSystemFitBreakdown,
  pickRandomSystems,
} from './systemDraft'

/** A center whose value is all at the rim: the archetype the whole affinity model exists to
 *  distinguish -- strong for post-heavy systems, necessarily weak for perimeter-and-pace ones. */
const postCenter = () =>
  makeTestPlayer({
    positions: ['C'],
    attributes: { insideShot: 90, vertical: 88, rebounding: 85, outsideShot: 30, passing: 35, ballHandling: 28, speed: 30 },
  })

/** The mirror image: a spacing guard who lives on the perimeter and in transition. */
const spacingGuard = () =>
  makeTestPlayer({
    positions: ['SG'],
    attributes: { insideShot: 35, vertical: 32, rebounding: 33, outsideShot: 92, passing: 85, ballHandling: 80, speed: 86 },
  })

describe('pickRandomSystems', () => {
  it('returns the requested count of distinct valid system ids', () => {
    const rng = createSeededRng(1)
    for (let i = 0; i < 20; i++) {
      const picks = pickRandomSystems(3, rng)
      expect(picks).toHaveLength(3)
      expect(new Set(picks).size).toBe(3)
      for (const id of picks) expect(Object.keys(OFFENSIVE_PLAYBOOKS)).toContain(id)
    }
  })
})

describe('computeInitialSynergyScore', () => {
  it('scores a post-heavy roster well against Twin Towers (post-up-weighted)', () => {
    const bigs = Array.from({ length: 5 }, () =>
      makeTestPlayer({ attributes: { insideShot: 90, vertical: 90, rebounding: 90, outsideShot: 30, ballHandling: 30, passing: 30, speed: 30 } }),
    )
    const score = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, bigs)
    // Twin Towers still weights pick-and-roll at 0.25, which also reads ballHandling/passing (low
    // for a pure-post roster), so this doesn't approach 90 -- just clearly above SYNERGY_NEUTRAL (65).
    expect(score).toBeGreaterThan(65)
  })

  it('scores the same post-heavy roster poorly against 7 Seconds or Less (transition/spot-up-weighted)', () => {
    const bigs = Array.from({ length: 5 }, () =>
      makeTestPlayer({ attributes: { insideShot: 90, vertical: 90, rebounding: 90, outsideShot: 30, ballHandling: 30, passing: 30, speed: 30 } }),
    )
    const score = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.sevenSecondsOrLess, bigs)
    expect(score).toBeLessThan(50)
  })

  it('a guard-heavy roster synergizes with 7 Seconds or Less better than with Twin Towers -- the anti-synergy pairing', () => {
    const guards = Array.from({ length: 5 }, () =>
      makeTestPlayer({ attributes: { speed: 90, passing: 90, outsideShot: 90, ballHandling: 90, insideShot: 30, vertical: 30, rebounding: 30 } }),
    )
    const fastBreakScore = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.sevenSecondsOrLess, guards)
    const postScore = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, guards)
    expect(fastBreakScore).toBeGreaterThan(postScore)
  })

  it('falls back to a neutral score for an empty roster rather than dividing by zero', () => {
    expect(computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.balanced, [])).toBe(65)
  })

  it('returns a value in the attribute-ish 40-99 range for a plausible average roster', () => {
    const roster = Array.from({ length: 5 }, () => makeTestPlayer())
    const score = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.balanced, roster)
    expect(score).toBeGreaterThanOrEqual(40)
    expect(score).toBeLessThanOrEqual(99)
  })
})

describe('computePlayerSystemAffinity', () => {
  it("is signed against the player's own baseline: a post center is positive for Twin Towers and negative for Pace and Space", () => {
    const center = postCenter()
    expect(computePlayerSystemAffinity(OFFENSIVE_PLAYBOOKS.twinTowers, center)).toBeGreaterThan(0)
    expect(computePlayerSystemAffinity(OFFENSIVE_PLAYBOOKS.paceAndSpace, center)).toBeLessThan(0)
  })

  it('mirrors that for a spacing guard -- the same two systems, opposite signs', () => {
    const guard = spacingGuard()
    expect(computePlayerSystemAffinity(OFFENSIVE_PLAYBOOKS.paceAndSpace, guard)).toBeGreaterThan(0)
    expect(computePlayerSystemAffinity(OFFENSIVE_PLAYBOOKS.twinTowers, guard)).toBeLessThan(0)
  })

  it('cannot rate a specialist well everywhere: affinities across all nine systems average to about zero', () => {
    // The coherence property. Affinity measures departure from an even play-call mix, and every
    // playbook's weights sum to 1, so strength somewhere must be paid for elsewhere.
    for (const player of [postCenter(), spacingGuard(), makeTestPlayer()]) {
      const affinities = (Object.keys(OFFENSIVE_PLAYBOOKS) as SystemId[]).map((id) =>
        computePlayerSystemAffinity(OFFENSIVE_PLAYBOOKS[id], player),
      )
      const mean = affinities.reduce((sum, a) => sum + a, 0) / affinities.length
      expect(Math.abs(mean)).toBeLessThan(5)
    }
  })

  it('is talent-neutral: scaling every attribute up leaves a player rated the same system fit', () => {
    const modest = makeTestPlayer({ attributes: { insideShot: 45, vertical: 44, rebounding: 43, outsideShot: 15, passing: 18, ballHandling: 14, speed: 15 } })
    const elite = makeTestPlayer({ attributes: { insideShot: 90, vertical: 88, rebounding: 86, outsideShot: 30, passing: 36, ballHandling: 28, speed: 30 } })
    // Same shape, double the numbers -- affinity should scale but keep the same sign and ordering,
    // where the old raw-quality measure would have rated the elite player higher for every system.
    for (const id of ['twinTowers', 'paceAndSpace', 'isoHeavy'] as SystemId[]) {
      expect(Math.sign(computePlayerSystemAffinity(OFFENSIVE_PLAYBOOKS[id], modest))).toBe(
        Math.sign(computePlayerSystemAffinity(OFFENSIVE_PLAYBOOKS[id], elite)),
      )
    }
  })

  it('sits near zero for an all-rounder -- no system suits a flat player more than any other', () => {
    const allRounder = makeTestPlayer()
    for (const id of Object.keys(OFFENSIVE_PLAYBOOKS) as SystemId[]) {
      expect(Math.abs(computePlayerSystemAffinity(OFFENSIVE_PLAYBOOKS[id], allRounder))).toBeLessThan(1)
    }
  })
})

describe('computeProjectedUsageShares', () => {
  it('sums to 1 across the roster', () => {
    const roster = [postCenter(), postCenter(), spacingGuard(), spacingGuard(), makeTestPlayer()]
    const shares = computeProjectedUsageShares(OFFENSIVE_PLAYBOOKS.balanced, roster)
    expect([...shares.values()].reduce((sum, s) => sum + s, 0)).toBeCloseTo(1, 10)
  })

  it('hands the ball to the bigs under Twin Towers and to the guards under 7 Seconds or Less', () => {
    const centers = [postCenter(), postCenter()]
    const guards = [spacingGuard(), spacingGuard()]
    const roster = [...centers, ...guards]
    const bigShare = (playbook: (typeof OFFENSIVE_PLAYBOOKS)[string]) => {
      const shares = computeProjectedUsageShares(playbook, roster)
      return centers.reduce((sum, p) => sum + shares.get(p.id)!, 0)
    }
    expect(bigShare(OFFENSIVE_PLAYBOOKS.twinTowers)).toBeGreaterThan(0.5)
    expect(bigShare(OFFENSIVE_PLAYBOOKS.sevenSecondsOrLess)).toBeLessThan(0.5)
  })

  it('concentrates touches on the better fit rather than splitting evenly -- the engine weights by score^exponent', () => {
    const star = spacingGuard()
    const scrub = makeTestPlayer({ attributes: { outsideShot: 30, passing: 30, ballHandling: 30, speed: 30 } })
    const shares = computeProjectedUsageShares(OFFENSIVE_PLAYBOOKS.paceAndSpace, [star, scrub])
    expect(shares.get(star.id)!).toBeGreaterThan(shares.get(scrub.id)!)
    // Weighted, not winner-take-all: the worse fit still touches the ball.
    expect(shares.get(scrub.id)!).toBeGreaterThan(0.02)
  })

  it('scales touches with minutes -- a bench specialist gets fewer of the possessions he suits', () => {
    const starter = postCenter()
    const benchTwin = postCenter()
    const roster = [starter, benchTwin]
    const shares = computeProjectedUsageShares(OFFENSIVE_PLAYBOOKS.twinTowers, roster, {
      rotationMinutes: { [starter.id]: 34, [benchTwin.id]: 8 },
    })
    expect(shares.get(starter.id)!).toBeGreaterThan(shares.get(benchTwin.id)! * 3)
  })
})

describe('touch logic in the team score', () => {
  it('rates Twin Towers well for two elite bigs beside three non-post guards -- the bigs take those possessions', () => {
    // The case roster-averaging got wrong: the guards cannot post up, but under Twin Towers they
    // barely have to, so their weakness there should cost far less than an average implies.
    const roster = [postCenter(), postCenter(), spacingGuard(), spacingGuard(), spacingGuard()]
    expect(computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, roster)).toBeGreaterThan(SYNERGY_NEUTRAL)
  })

  it('still punishes a roster with nobody suited to the system s core play call', () => {
    const allGuards = Array.from({ length: 5 }, spacingGuard)
    expect(computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, allGuards)).toBeLessThan(SYNERGY_NEUTRAL)
  })
})

describe('minutes weighting', () => {
  const bigMinutes = (starters: ReturnType<typeof postCenter>[], bench: ReturnType<typeof postCenter>[]) => ({
    rotationMinutes: Object.fromEntries([...starters.map((p) => [p.id, 34]), ...bench.map((p) => [p.id, 6])]),
  })

  it('lets the rotation move the score: the same players weighted toward the post unit rate Twin Towers higher', () => {
    const centers = [postCenter(), postCenter()]
    const guards = [spacingGuard(), spacingGuard()]
    const roster = [...centers, ...guards]

    const centersPlay = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, roster, bigMinutes(centers, guards))
    const guardsPlay = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, roster, bigMinutes(guards, centers))
    expect(centersPlay).toBeGreaterThan(guardsPlay)
  })

  it('counts everyone equally when minutes are absent or all zero rather than dividing by zero', () => {
    const roster = [postCenter(), spacingGuard()]
    const allZero = { rotationMinutes: Object.fromEntries(roster.map((p) => [p.id, 0])) }
    expect(computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.balanced, roster, allZero)).toBe(
      computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.balanced, roster),
    )
  })
})

/**
 * The chart, not rotationMinutes, is what actually decides who plays once a GM has authored one
 * (rotation-charts.md Phase F/G), so it has to reach the same projection minutes always fed.
 */
describe('rotation chart weighting', () => {
  const wholePeriod = (playerId: PlayerId) => [
    { startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'player' as const, playerId } },
  ]
  const halfPeriod = (playerId: PlayerId) => [
    { startSeconds: 0, endSeconds: PERIOD_SECONDS / 2, fill: { kind: 'player' as const, playerId } },
    { startSeconds: PERIOD_SECONDS / 2, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' as const } },
  ]
  /** The same segments in all four regulation periods -- a chart covering the whole game. */
  const everyPeriod = (bySlot: Partial<Record<Position, RotationSegment[]>>): RotationPlan =>
    Object.fromEntries(CHARTABLE_PERIODS.map((period) => [period, bySlot]))

  it('is a no-op when the chart is all Auto -- identical to having no plan at all', () => {
    const roster = [postCenter(), spacingGuard()]
    const rotationMinutes = { [roster[0].id]: 30, [roster[1].id]: 30 }
    const allAuto = everyPeriod({ C: [{ startSeconds: 0, endSeconds: PERIOD_SECONDS, fill: { kind: 'auto' } }] })

    expect(computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.balanced, roster, { rotationMinutes, rotationPlan: allAuto })).toBe(
      computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.balanced, roster, { rotationMinutes }),
    )
  })

  it('hands a slot charted end to end to the charted player, leaving his backup nothing', () => {
    const starter = postCenter()
    const backup = postCenter()
    const roster = [starter, backup]
    // Minutes say the backup should get a third of the C slot; the chart says otherwise, all game.
    const rotationMinutes = { [starter.id]: 32, [backup.id]: 16 }
    const rotationPlan = everyPeriod({ C: wholePeriod(starter.id) })

    const shares = computeProjectedUsageShares(OFFENSIVE_PLAYBOOKS.twinTowers, roster, { rotationMinutes, rotationPlan })

    expect(shares.get(starter.id)!).toBeCloseTo(1, 5)
    expect(shares.get(backup.id)!).toBeCloseTo(0, 5)
  })

  it('prorates target minutes across whatever Auto time the chart leaves', () => {
    const starter = postCenter()
    const backup = postCenter()
    const roster = [starter, backup]
    const rotationMinutes = { [starter.id]: 24, [backup.id]: 24 }

    // Half the C slot charted to the starter: he takes his 24 charted minutes plus half his target,
    // the backup only half of his. So the starter's edge exists but isn't total.
    const half = computeProjectedUsageShares(OFFENSIVE_PLAYBOOKS.twinTowers, roster, {
      rotationMinutes,
      rotationPlan: everyPeriod({ C: halfPeriod(starter.id) }),
    })
    expect(half.get(starter.id)!).toBeGreaterThan(half.get(backup.id)!)
    expect(half.get(backup.id)!).toBeGreaterThan(0.1) // still meaningfully in the rotation

    // Charting the whole slot instead should push the starter strictly further ahead.
    const full = computeProjectedUsageShares(OFFENSIVE_PLAYBOOKS.twinTowers, roster, {
      rotationMinutes,
      rotationPlan: everyPeriod({ C: wholePeriod(starter.id) }),
    })
    expect(full.get(starter.id)!).toBeGreaterThan(half.get(starter.id)!)
  })

  it('counts charted time at a slot that is not the player s own -- he is on the floor either way', () => {
    const center = postCenter()
    const guard = spacingGuard()
    const roster = [center, guard]
    // Nobody has target minutes at all, so the only thing feeding availability is the chart -- and
    // it charts the center into the SG slot, which is not his position.
    const rotationPlan = everyPeriod({ SG: wholePeriod(center.id) })

    const shares = computeProjectedUsageShares(OFFENSIVE_PLAYBOOKS.twinTowers, roster, {
      rotationMinutes: { [center.id]: 0, [guard.id]: 0 },
      rotationPlan,
    })

    expect(shares.get(center.id)!).toBeCloseTo(1, 5)
  })

  it('moves the score: charting the post unit into real minutes rates Twin Towers higher than charting the guards', () => {
    const centers = [postCenter(), postCenter()]
    const guards = [spacingGuard(), spacingGuard()]
    const roster = [...centers, ...guards]
    // Identical players and identical target minutes in both cases -- the chart is the only variable.
    const rotationMinutes = Object.fromEntries(roster.map((p) => [p.id, 24]))

    const bigsCharted = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, roster, {
      rotationMinutes,
      rotationPlan: everyPeriod({ C: wholePeriod(centers[0].id), SG: wholePeriod(centers[1].id) }),
    })
    const guardsCharted = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS.twinTowers, roster, {
      rotationMinutes,
      rotationPlan: everyPeriod({ C: wholePeriod(guards[0].id), SG: wholePeriod(guards[1].id) }),
    })

    expect(bigsCharted).toBeGreaterThan(guardsCharted)
  })
})

describe('computeSystemFitBreakdown', () => {
  it('lists only the play calls a system actually runs, heaviest first, with weights normalized to 1', () => {
    const roster = Array.from({ length: 5 }, () => makeTestPlayer())
    const breakdown = computeSystemFitBreakdown(OFFENSIVE_PLAYBOOKS.twinTowers, roster)

    // Twin Towers zeroes out isolation and transition.
    expect(breakdown.map((f) => f.playCall)).not.toContain('isolation')
    expect(breakdown.map((f) => f.playCall)).not.toContain('transition')
    expect(breakdown[0].playCall).toBe('post-up')
    expect(breakdown.reduce((sum, f) => sum + f.weight, 0)).toBeCloseTo(1, 10)
  })

  it('grades each play call against the roster on the 0-100 attribute scale', () => {
    const bigs = Array.from({ length: 5 }, () => makeTestPlayer({ attributes: { insideShot: 90, vertical: 90, speed: 20, passing: 20 } }))
    const breakdown = computeSystemFitBreakdown(OFFENSIVE_PLAYBOOKS.balanced, bigs)
    const postUp = breakdown.find((f) => f.playCall === 'post-up')!
    const cutting = breakdown.find((f) => f.playCall === 'cutting')!
    expect(postUp.rosterQuality).toBe(90)
    expect(cutting.rosterQuality).toBe(20)
  })

  it('reports each play call against the roster baseline, which is what actually moves the score', () => {
    const bigs = Array.from({ length: 5 }, () => makeTestPlayer({ attributes: { insideShot: 90, vertical: 90, speed: 20, passing: 20 } }))
    const breakdown = computeSystemFitBreakdown(OFFENSIVE_PLAYBOOKS.balanced, bigs)
    expect(breakdown.find((f) => f.playCall === 'post-up')!.vsBaseline).toBeGreaterThan(0)
    expect(breakdown.find((f) => f.playCall === 'cutting')!.vsBaseline).toBeLessThan(0)
  })

  it('reports every play call as baseline-neutral for a roster with no lean', () => {
    // Shoot-first specifically: isolation's strength formula folds in TENDENCY_SHOT_SELECTION, and
    // shoot-first is the tendency whose value (50) matches these attributes, so every play call
    // grades exactly 50 and nothing leans. A balanced-tendency player would read +2 on Isolation.
    const flat = Array.from({ length: 5 }, () => makeTestPlayer({ hidden: { tendency: 'shoot-first' } }))
    for (const fit of computeSystemFitBreakdown(OFFENSIVE_PLAYBOOKS.balanced, flat)) {
      expect(fit.vsBaseline).toBeCloseTo(0, 10)
    }
  })

  it('carries tendency into isolation the way the engine does -- a pass-first creator takes better iso shots', () => {
    const passFirst = Array.from({ length: 5 }, () => makeTestPlayer({ hidden: { tendency: 'pass-first' } }))
    const shootFirst = Array.from({ length: 5 }, () => makeTestPlayer({ hidden: { tendency: 'shoot-first' } }))
    const isoQuality = (roster: ReturnType<typeof makeTestPlayer>[]) =>
      computeSystemFitBreakdown(OFFENSIVE_PLAYBOOKS.isoHeavy, roster).find((f) => f.playCall === 'isolation')!.rosterQuality
    expect(isoQuality(passFirst)).toBeGreaterThan(isoQuality(shootFirst))
  })

  it('grades an empty roster at zero rather than dividing by zero', () => {
    for (const fit of computeSystemFitBreakdown(OFFENSIVE_PLAYBOOKS.balanced, [])) {
      expect(fit.rosterQuality).toBe(0)
    }
  })
})
