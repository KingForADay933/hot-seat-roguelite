import { describe, expect, it } from 'vitest'
import { SHOP_CONDENSED_PLAYER_CAMP_LIMIT, SHOP_EXPANDED_PLAYER_CAMP_LIMIT, SHOP_EXPANDED_TEAM_CAMP_LIMIT } from '../constants'
import { openShopVisit } from './shopVisit'

describe('openShopVisit', () => {
  it('grants only single-player camp purchase power on the condensed tier', () => {
    const visit = openShopVisit('condensed')
    expect(visit.tier).toBe('condensed')
    expect(visit.playerCampsRemaining).toBe(SHOP_CONDENSED_PLAYER_CAMP_LIMIT)
    expect(visit.teamCampsRemaining).toBe(0)
  })

  it('grants more player-camp purchase power plus team-camp purchase power on the expanded tier', () => {
    const visit = openShopVisit('expanded')
    expect(visit.tier).toBe('expanded')
    expect(visit.playerCampsRemaining).toBe(SHOP_EXPANDED_PLAYER_CAMP_LIMIT)
    expect(visit.teamCampsRemaining).toBe(SHOP_EXPANDED_TEAM_CAMP_LIMIT)
  })
})
