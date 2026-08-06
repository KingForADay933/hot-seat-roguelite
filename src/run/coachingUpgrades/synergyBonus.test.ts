import { describe, expect, it } from 'vitest'
import { PLAYERS_COACH_SYNERGY_BONUS, SYSTEM_GURU_SYNERGY_BONUS } from '../constants'
import { computeSynergyUpgradeBonus } from './synergyBonus'

describe('computeSynergyUpgradeBonus', () => {
  it('returns 0 when neither synergy-affecting upgrade is owned', () => {
    expect(computeSynergyUpgradeBonus(['clutch-gene', 'iron-man-program'])).toBe(0)
  })

  it("adds Players' Coach's bonus when owned", () => {
    expect(computeSynergyUpgradeBonus(['players-coach'])).toBe(PLAYERS_COACH_SYNERGY_BONUS)
  })

  it('adds System Guru\'s bonus when owned', () => {
    expect(computeSynergyUpgradeBonus(['system-guru'])).toBe(SYSTEM_GURU_SYNERGY_BONUS)
  })

  it('sums both bonuses when both are owned', () => {
    expect(computeSynergyUpgradeBonus(['players-coach', 'system-guru'])).toBe(PLAYERS_COACH_SYNERGY_BONUS + SYSTEM_GURU_SYNERGY_BONUS)
  })
})
