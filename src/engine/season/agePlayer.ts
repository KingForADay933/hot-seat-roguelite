import type { Player } from '../../data/types'
import { computeAgeCurveStage } from '../generator/ageCurve'

/**
 * Advances age and the derived ageCurveStage label only -- intentionally narrow. Attribute
 * growth/decay is a separate concern (engine/development/growPlayerOneSeason.ts), orchestrated
 * alongside this one by engine/season/developSeason.ts, which calls growth first and this last.
 */
export function agePlayerOneYear(player: Player): Player {
  const age = player.age + 1
  return {
    ...player,
    age,
    development: { ...player.development, ageCurveStage: computeAgeCurveStage(age) },
  }
}
