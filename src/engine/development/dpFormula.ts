import type { AgeCurveStage, PracticeSettings } from '../../data/types'
import {
  COACHING_DP_FACTOR,
  COACHING_MULT_MAX,
  COACHING_MULT_MIN,
  COACHING_NEUTRAL_RATING,
  DP_DECLINE_AGE_PENALTY,
  DP_DECLINE_BASE,
  DP_DECLINE_FLOOR,
  DP_PEAK_BASE,
  DP_PER_SEASON_MINUTE,
  DP_PLAYING_TIME_CAP,
  DP_PRACTICE_BONUS_MAX,
  DP_RISING_AGE_BONUS,
  DP_RISING_BASE,
} from '../constants'
import { clamp } from '../math'

export function computeBaseDP(age: number, stage: AgeCurveStage): number {
  if (stage === 'rising') return DP_RISING_BASE + DP_RISING_AGE_BONUS * (23 - age)
  if (stage === 'peak') return DP_PEAK_BASE
  return clamp(DP_DECLINE_BASE - DP_DECLINE_AGE_PENALTY * (age - 30), DP_DECLINE_FLOOR, DP_DECLINE_BASE)
}

export function computePlayingTimeBonus(totalSeasonMinutes: number): number {
  return clamp(totalSeasonMinutes * DP_PER_SEASON_MINUTE, 0, DP_PLAYING_TIME_CAP)
}

export function computePracticeBonus(practiceSettings: PracticeSettings): number {
  return DP_PRACTICE_BONUS_MAX * (practiceSettings.individualDevelopmentShare / 100)
}

/**
 * A good coach must always help, whichever direction DP is already trending -- naively
 * multiplying an already-negative pre-multiplier value by a >1 "good coach" multiplier would make
 * decline *worse*, which is backwards. So growth is scaled up/down normally, but decline is
 * *divided* by the same multiplier -- shrinks its magnitude for a good coach (mult > 1), grows it
 * for a bad one (mult < 1).
 */
export function applyCoachingMultiplier(preMultiplierDP: number, headCoachRating: number): number {
  const mult = clamp(
    1 + (headCoachRating - COACHING_NEUTRAL_RATING) * COACHING_DP_FACTOR,
    COACHING_MULT_MIN,
    COACHING_MULT_MAX,
  )
  return preMultiplierDP >= 0 ? preMultiplierDP * mult : preMultiplierDP / mult
}

export function computeSeasonDP(
  age: number,
  stage: AgeCurveStage,
  totalSeasonMinutes: number,
  practiceSettings: PracticeSettings,
  headCoachRating: number,
): number {
  const preMultiplier =
    computeBaseDP(age, stage) + computePlayingTimeBonus(totalSeasonMinutes) + computePracticeBonus(practiceSettings)
  return applyCoachingMultiplier(preMultiplier, headCoachRating)
}
