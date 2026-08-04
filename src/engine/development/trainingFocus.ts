import type { AttributeKey, Player } from '../../data/types'

export const ATTRIBUTE_KEYS = Object.keys({
  insideShot: 0,
  outsideShot: 0,
  passing: 0,
  ballHandling: 0,
  rebounding: 0,
  perimeterDefense: 0,
  interiorDefense: 0,
  speed: 0,
  lateralQuickness: 0,
  vertical: 0,
}) as AttributeKey[]

function normalize(weights: Record<AttributeKey, number>): Record<AttributeKey, number> {
  const total = ATTRIBUTE_KEYS.reduce((sum, key) => sum + weights[key], 0)
  if (total <= 0) {
    const even = 1 / ATTRIBUTE_KEYS.length
    return Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, even])) as Record<AttributeKey, number>
  }
  return Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, weights[key] / total])) as Record<AttributeKey, number>
}

/**
 * Normalized (sums to 1) effective focus weights for one player. If the team has an explicit,
 * non-empty, non-all-zero override for this player, uses it (missing attribute keys treated as 0).
 * Otherwise auto-computes weight_i proportional to that attribute's gap-to-potential -- a player
 * with no GM override gets exactly the growth the auto-weighting would produce, so there's no
 * "forgot to allocate, wasted a season" trap.
 */
export function computeEffectiveFocusWeights(
  player: Player,
  teamOverride: Partial<Record<AttributeKey, number>> | undefined,
): Record<AttributeKey, number> {
  if (teamOverride) {
    const explicit = Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, Math.max(0, teamOverride[key] ?? 0)]),
    ) as Record<AttributeKey, number>
    const explicitTotal = ATTRIBUTE_KEYS.reduce((sum, key) => sum + explicit[key], 0)
    if (explicitTotal > 0) return normalize(explicit)
  }

  const gaps = Object.fromEntries(
    ATTRIBUTE_KEYS.map((key) => [key, Math.max(0, player.development.potential[key] - player.attributes[key])]),
  ) as Record<AttributeKey, number>
  return normalize(gaps)
}
