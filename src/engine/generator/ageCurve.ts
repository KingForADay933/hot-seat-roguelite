import type { AgeCurveStage } from '../../data/types'

/** Shared bracket logic so initial generation and season rollover can never drift apart. */
export function computeAgeCurveStage(age: number): AgeCurveStage {
  return age < 24 ? 'rising' : age < 30 ? 'peak' : 'declining'
}
