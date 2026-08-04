import { describe, expect, it } from 'vitest'
import type { OffensivePlaybook } from '../../data/presets'
import { makeTestPlayer } from '../testFixtures'
import type { PlaySelection } from './playerSelector'
import { computeOffenseStrength } from './possessionStrength'

const dummyDefender = makeTestPlayer()

function playbook(ballMovementModifier: number): OffensivePlaybook {
  return {
    id: 'test',
    name: 'Test',
    ballMovementModifier,
    weights: {
      'pick-and-roll': 1,
      isolation: 0,
      'post-up': 0,
      'spot-up': 0,
      cutting: 0,
      transition: 0,
    },
  }
}

function selection(primary: ReturnType<typeof makeTestPlayer>, secondaries: ReturnType<typeof makeTestPlayer>[] = []): PlaySelection {
  return {
    primary,
    secondaries,
    primaryDefender: dummyDefender,
    secondaryDefenders: [],
    isOutsideShotAction: false,
  }
}

describe('computeOffenseStrength', () => {
  it('pick-and-roll: weights handler ball-handling/passing and roller inside-shot/vertical, scaled by ball movement', () => {
    const handler = makeTestPlayer({ attributes: { ballHandling: 80, passing: 60 } })
    const roller = makeTestPlayer({ attributes: { insideShot: 70, vertical: 90 } })
    const s = computeOffenseStrength('pick-and-roll', selection(handler, [roller]), playbook(1.2), [handler, roller])
    // 0.35*80 + 0.25*60 + 0.25*70 + 0.15*90 = 74, * 1.2 = 88.8
    expect(s).toBeCloseTo(88.8, 5)
  })

  it('isolation: uses max(outsideShot, insideShot) and the tendency shot-selection modifier, unscaled by ball movement', () => {
    const handler = makeTestPlayer({
      attributes: { ballHandling: 70, outsideShot: 80, insideShot: 60 },
      hidden: { tendency: 'balanced' },
    })
    const s = computeOffenseStrength('isolation', selection(handler), playbook(1.5), [handler])
    // 0.4*70 + 0.35*80 + 0.25*60(balanced modifier) = 28+28+15 = 71 -- NOT scaled by the 1.5 ballMovementModifier
    expect(s).toBeCloseTo(71, 5)
  })

  it('post-up: weights inside shot and vertical only', () => {
    const poster = makeTestPlayer({ attributes: { insideShot: 75, vertical: 65 } })
    const s = computeOffenseStrength('post-up', selection(poster), playbook(1), [poster])
    expect(s).toBeCloseTo(71, 5) // 0.6*75 + 0.4*65
  })

  it('spot-up: weights shooter outside-shot and creator passing, scaled by ball movement', () => {
    const shooter = makeTestPlayer({ attributes: { outsideShot: 85 } })
    const creator = makeTestPlayer({ attributes: { passing: 55 } })
    const s = computeOffenseStrength('spot-up', selection(shooter, [creator]), playbook(1.1), [shooter, creator])
    // (0.55*85 + 0.45*55) * 1.1 = 71.5 * 1.1 = 78.65
    expect(s).toBeCloseTo(78.65, 5)
  })

  it('transition: includes the on-court team rebounding average', () => {
    const handler = makeTestPlayer({ attributes: { speed: 85, passing: 65 } })
    const teammates = [makeTestPlayer(), makeTestPlayer(), makeTestPlayer(), makeTestPlayer()]
    const s = computeOffenseStrength('transition', selection(handler), playbook(1), [handler, ...teammates])
    // rebounding avg = 50 (default), 0.4*85 + 0.3*65 + 0.3*50 = 68.5
    expect(s).toBeCloseTo(68.5, 5)
  })
})
