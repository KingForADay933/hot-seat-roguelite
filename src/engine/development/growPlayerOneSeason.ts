import type { AttributeKey, Player } from '../../data/types'
import {
  ATTRIBUTE_CEILING,
  ATTRIBUTE_FLOOR,
  DECAY_RATE_MULTIPLIER,
  DP_TO_ATTRIBUTE_RATE,
  EASE_OUT_MIN_FACTOR,
  EASE_OUT_REFERENCE_GAP,
  UNFOCUSED_TRICKLE_SHARE,
} from '../constants'
import { average, clamp } from '../math'
import { ATTRIBUTE_KEYS } from './trainingFocus'

function easeOut(gap: number): number {
  return clamp(gap / EASE_OUT_REFERENCE_GAP, EASE_OUT_MIN_FACTOR, 1)
}

/**
 * Pure. Resolves one season's growth or decay for a single player's attributes, given their
 * already-computed netDP and effective focus weights. Does NOT touch age/ageCurveStage -- that
 * stays agePlayerOneYear's sole responsibility (see engine/season/developSeason.ts, which calls
 * both, this one first).
 *
 * Growth (netDP >= 0): netDP splits into a small even trickle across all attributes (unfocused
 * attributes still grow slowly) plus a focus-weighted majority share, each tapered by an ease-out
 * factor based on remaining gap-to-potential -- closing the gap gets smaller as the gap gets
 * smaller. Potential is a hard ceiling.
 *
 * Decay (netDP < 0): spread evenly across all attributes regardless of focus -- Training Focus is
 * an investment choice, not a shield against decline, which would add a second axis of complexity
 * the design doc doesn't ask for. Floored at ATTRIBUTE_FLOOR -- the same universal minimum
 * generation itself respects, so a long-lived veteran (no retirement system exists yet) can never
 * decay below a level a rookie could ever have been generated with.
 */
export function growPlayerOneSeason(
  player: Player,
  netDP: number,
  focusWeights: Record<AttributeKey, number>,
): Player {
  const attributes = { ...player.attributes }

  if (netDP >= 0) {
    for (const key of ATTRIBUTE_KEYS) {
      const gap = Math.max(0, player.development.potential[key] - player.attributes[key])
      const attributeDP = netDP * UNFOCUSED_TRICKLE_SHARE * (1 / ATTRIBUTE_KEYS.length) + netDP * (1 - UNFOCUSED_TRICKLE_SHARE) * focusWeights[key]
      const growth = attributeDP * DP_TO_ATTRIBUTE_RATE * easeOut(gap)
      attributes[key] = clamp(
        player.attributes[key] + growth,
        ATTRIBUTE_FLOOR,
        Math.min(player.development.potential[key], ATTRIBUTE_CEILING),
      )
    }
  } else {
    const declinePoints = (Math.abs(netDP) * DP_TO_ATTRIBUTE_RATE * DECAY_RATE_MULTIPLIER) / ATTRIBUTE_KEYS.length
    for (const key of ATTRIBUTE_KEYS) {
      attributes[key] = clamp(player.attributes[key] - declinePoints, ATTRIBUTE_FLOOR, ATTRIBUTE_CEILING)
    }
  }

  return {
    ...player,
    attributes,
    // Keep the display-only overallRating in sync -- it would otherwise silently go stale the
    // moment growth/decay first touches a player, since it was only ever computed once at
    // generation. Still never read by simulation/rotation logic (see rawOverallQuality's own
    // comment in engine/matchup.ts for why that duplicates this formula instead of reading here).
    overallRating: Math.round(average(Object.values(attributes))),
    development: { ...player.development, developmentPoints: netDP },
  }
}
