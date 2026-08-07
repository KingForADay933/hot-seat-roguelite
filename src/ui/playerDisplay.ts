import type { AttributeKey, Team } from '../data/types'
import { ATTRIBUTE_COLUMNS } from './attributeColumns'

/** 79 -> 6'7" -- players are stored in raw inches, which reads as nonsense in a roster table. */
export function formatHeight(heightInches: number): string {
  return `${Math.floor(heightInches / 12)}'${heightInches % 12}"`
}

/** The single focused attribute this UI wrote for a player, if any -- setTrainingFocus (RunProvider)
 *  only ever writes a single-key override, so the first key is always the whole answer. */
export function currentTrainingFocus(team: Team, playerId: string): AttributeKey | null {
  const override = team.trainingFocus[playerId]
  if (!override) return null
  const keys = Object.keys(override) as AttributeKey[]
  return keys[0] ?? null
}

/** Short column label ("INS") for an attribute key, for use outside the attribute table itself. */
export function attributeLabel(key: AttributeKey): string {
  return ATTRIBUTE_COLUMNS.find((col) => col.key === key)?.label ?? key
}

export const AGE_CURVE_LABELS = {
  rising: 'Rising',
  peak: 'Peak',
  declining: 'Declining',
} as const

export const TENDENCY_LABELS = {
  'pass-first': 'Pass-first',
  balanced: 'Balanced',
  'shoot-first': 'Shoot-first',
} as const
