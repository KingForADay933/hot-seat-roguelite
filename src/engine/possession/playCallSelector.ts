import type { OffensivePlaybook } from '../../data/presets'
import type { PlayCallType } from '../../data/types'
import type { Rng } from '../rng'

/** Weights needn't sum to 1.0 — normalized here against whatever total the positive-weight entries have. */
export function selectPlayCall(playbook: OffensivePlaybook, rng: Rng): PlayCallType {
  const entries = (Object.entries(playbook.weights) as [PlayCallType, number][]).filter(
    ([, weight]) => weight > 0,
  )
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  if (total <= 0) {
    throw new Error(`Playbook "${playbook.id}" has no positive-weight play calls`)
  }

  let roll = rng() * total
  for (const [call, weight] of entries) {
    if (roll < weight) return call
    roll -= weight
  }
  return entries[entries.length - 1][0]
}
