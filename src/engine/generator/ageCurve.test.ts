import { describe, expect, it } from 'vitest'
import { computeAgeCurveStage } from './ageCurve'

describe('computeAgeCurveStage', () => {
  it('is rising below 24', () => {
    expect(computeAgeCurveStage(23)).toBe('rising')
  })

  it('is peak from 24 up to 29', () => {
    expect(computeAgeCurveStage(24)).toBe('peak')
    expect(computeAgeCurveStage(29)).toBe('peak')
  })

  it('is declining from 30 up', () => {
    expect(computeAgeCurveStage(30)).toBe('declining')
  })
})
