import { describe, expect, it } from 'vitest'
import type { OffensivePlaybook } from '../../data/presets'
import { selectPlayCall } from './playCallSelector'

function makePlaybook(weights: Partial<OffensivePlaybook['weights']>): OffensivePlaybook {
  return {
    id: 'test',
    name: 'Test',
    ballMovementModifier: 1,
    weights: {
      'pick-and-roll': 0,
      isolation: 0,
      'post-up': 0,
      'spot-up': 0,
      cutting: 0,
      transition: 0,
      ...weights,
    },
  }
}

function queue(...values: number[]) {
  let i = 0
  return () => values[i++]
}

describe('selectPlayCall', () => {
  it('draws the play call whose cumulative weight band the roll lands in', () => {
    const playbook = makePlaybook({ isolation: 0.5, 'post-up': 0.5 })
    expect(selectPlayCall(playbook, queue(0))).toBe('isolation')
    expect(selectPlayCall(playbook, queue(0.49))).toBe('isolation')
    expect(selectPlayCall(playbook, queue(0.51))).toBe('post-up')
    expect(selectPlayCall(playbook, queue(0.99))).toBe('post-up')
  })

  it('normalizes weights that do not sum to 1.0', () => {
    const playbook = makePlaybook({ isolation: 2, 'post-up': 2 }) // sums to 4, not 1
    expect(selectPlayCall(playbook, queue(0.1))).toBe('isolation') // 0.1*4=0.4 < 2
    expect(selectPlayCall(playbook, queue(0.6))).toBe('post-up') // 0.6*4=2.4, past isolation's 2
  })

  it('ignores zero-weight play calls entirely', () => {
    const playbook = makePlaybook({ isolation: 1 })
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(selectPlayCall(playbook, queue(roll))).toBe('isolation')
    }
  })

  it('throws if the playbook has no positive-weight play calls', () => {
    const playbook = makePlaybook({})
    expect(() => selectPlayCall(playbook, queue(0))).toThrow()
  })
})
