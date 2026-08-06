import { describe, expect, it } from 'vitest'
import { SHOP_CONDENSED_PLAYER_CAMPS, SHOP_EXPANDED_PLAYER_CAMPS, SHOP_EXPANDED_TEAM_CAMPS } from '../constants'
import { openShopVisit } from './shopVisit'

describe('openShopVisit', () => {
  it('condensed tier grants only player-camp purchase power', () => {
    const visit = openShopVisit('condensed')
    expect(visit.playerCampsRemaining).toBe(SHOP_CONDENSED_PLAYER_CAMPS)
    expect(visit.teamCampsRemaining).toBe(0)
  })

  it('expanded tier grants more player-camp power plus team-camp power', () => {
    const visit = openShopVisit('expanded')
    expect(visit.playerCampsRemaining).toBe(SHOP_EXPANDED_PLAYER_CAMPS)
    expect(visit.teamCampsRemaining).toBe(SHOP_EXPANDED_TEAM_CAMPS)
    expect(visit.playerCampsRemaining).toBeGreaterThan(SHOP_CONDENSED_PLAYER_CAMPS)
  })
})
