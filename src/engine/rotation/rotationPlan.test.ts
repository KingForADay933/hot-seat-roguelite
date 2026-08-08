import { describe, expect, it } from 'vitest'
import type { RotationPlan } from '../../data/types'
import { chartedPlayerId } from './rotationPlan'

describe('chartedPlayerId', () => {
  it('is null with no plan at all', () => {
    expect(chartedPlayerId(undefined, 1, 'PG', 0)).toBeNull()
  })

  it('is null when the plan has no entry for this period', () => {
    const plan: RotationPlan = { 2: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'player', playerId: 'p1' } }] } }
    expect(chartedPlayerId(plan, 1, 'PG', 0)).toBeNull()
  })

  it('is null when the period has no entry for this slot', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'player', playerId: 'p1' } }] } }
    expect(chartedPlayerId(plan, 1, 'C', 0)).toBeNull()
  })

  it('returns the charted player when a segment covers the time', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'player', playerId: 'p1' } }] } }
    expect(chartedPlayerId(plan, 1, 'PG', 300)).toBe('p1')
  })

  it('is null for an explicit auto segment, same as no segment at all', () => {
    const plan: RotationPlan = { 1: { PG: [{ startSeconds: 0, endSeconds: 720, fill: { kind: 'auto' } }] } }
    expect(chartedPlayerId(plan, 1, 'PG', 300)).toBeNull()
  })

  it('is null in a gap between two segments -- unfilled time is implicitly Auto', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 200, fill: { kind: 'player', playerId: 'starter' } },
          { startSeconds: 500, endSeconds: 720, fill: { kind: 'player', playerId: 'closer' } },
        ],
      },
    }
    expect(chartedPlayerId(plan, 1, 'PG', 350)).toBeNull()
  })

  it('picks the right segment among several, by time', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 200, fill: { kind: 'player', playerId: 'starter' } },
          { startSeconds: 200, endSeconds: 500, fill: { kind: 'auto' } },
          { startSeconds: 500, endSeconds: 720, fill: { kind: 'player', playerId: 'closer' } },
        ],
      },
    }
    expect(chartedPlayerId(plan, 1, 'PG', 0)).toBe('starter')
    expect(chartedPlayerId(plan, 1, 'PG', 300)).toBeNull()
    expect(chartedPlayerId(plan, 1, 'PG', 719)).toBe('closer')
  })

  it('treats segment boundaries as half-open -- startSeconds included, endSeconds excluded', () => {
    const plan: RotationPlan = {
      1: {
        PG: [
          { startSeconds: 0, endSeconds: 200, fill: { kind: 'player', playerId: 'first' } },
          { startSeconds: 200, endSeconds: 400, fill: { kind: 'player', playerId: 'second' } },
        ],
      },
    }
    expect(chartedPlayerId(plan, 1, 'PG', 200)).toBe('second') // start of the next segment
    expect(chartedPlayerId(plan, 1, 'PG', 199.999)).toBe('first') // still just inside the first
  })
})
