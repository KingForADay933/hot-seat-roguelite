import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../testFixtures'
import { agePlayerOneYear } from './agePlayer'

describe('agePlayerOneYear', () => {
  it('increments age by exactly 1', () => {
    const player = makeTestPlayer()
    player.age = 25
    const aged = agePlayerOneYear(player)
    expect(aged.age).toBe(26)
  })

  it('flips ageCurveStage across a boundary', () => {
    const player = makeTestPlayer()
    player.age = 23
    player.development.ageCurveStage = 'rising'
    const aged = agePlayerOneYear(player)
    expect(aged.age).toBe(24)
    expect(aged.development.ageCurveStage).toBe('peak')
  })

  it('leaves every other field unchanged, including attributes', () => {
    const player = makeTestPlayer({ attributes: { insideShot: 77 } })
    const aged = agePlayerOneYear(player)
    expect(aged.attributes).toEqual(player.attributes)
    expect(aged.hidden).toEqual(player.hidden)
    expect(aged.id).toBe(player.id)
    expect(aged.name).toBe(player.name)
    expect(aged.overallRating).toBe(player.overallRating)
    expect(aged.development.potential).toEqual(player.development.potential)
    expect(aged.development.developmentPoints).toBe(player.development.developmentPoints)
  })

  it('does not mutate the input player', () => {
    const player = makeTestPlayer()
    const originalAge = player.age
    agePlayerOneYear(player)
    expect(player.age).toBe(originalAge)
  })
})
