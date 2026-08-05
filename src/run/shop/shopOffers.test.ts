import { describe, expect, it } from 'vitest'
import { makeTestPlayer } from '../../engine/testFixtures'
import { createSeededRng } from '../../engine/rng'
import { PLAYER_CAMP_COST, SHOP_EXPANDED_PLAYER_OFFER_COUNT, SHOP_EXPANDED_REROLLS, SHOP_EXPANDED_TEAM_OFFER_COUNT, TEAM_CAMP_COST } from '../constants'
import { generateShopOffers, openShopVisit } from './shopOffers'

function makeRoster(size: number) {
  return Array.from({ length: size }, () => makeTestPlayer())
}

describe('generateShopOffers', () => {
  it('condensed tier rolls cheap, distinct player-camp offers only', () => {
    const roster = makeRoster(10)
    const offers = generateShopOffers('condensed', roster, createSeededRng(1))
    expect(offers.length).toBeGreaterThan(0)
    for (const offer of offers) {
      expect(offer.type).toBe('player-camp')
      expect(offer.cost).toBe(PLAYER_CAMP_COST)
      expect(offer.playerId).not.toBeNull()
    }
    expect(new Set(offers.map((o) => o.playerId)).size).toBe(offers.length)
  })

  it('expanded tier adds pricier team-camp offers on top of player-camp offers', () => {
    const roster = makeRoster(10)
    const offers = generateShopOffers('expanded', roster, createSeededRng(1))
    const playerOffers = offers.filter((o) => o.type === 'player-camp')
    const teamOffers = offers.filter((o) => o.type === 'team-camp')
    expect(playerOffers).toHaveLength(SHOP_EXPANDED_PLAYER_OFFER_COUNT)
    expect(teamOffers).toHaveLength(SHOP_EXPANDED_TEAM_OFFER_COUNT)
    for (const offer of teamOffers) {
      expect(offer.cost).toBe(TEAM_CAMP_COST)
      expect(offer.playerId).toBeNull()
    }
  })

  it('never rolls more player-camp offers than the roster has players', () => {
    const roster = makeRoster(1)
    const offers = generateShopOffers('condensed', roster, createSeededRng(1))
    expect(offers).toHaveLength(1)
  })
})

describe('openShopVisit', () => {
  it('grants no rerolls on the condensed tier', () => {
    const visit = openShopVisit('condensed', makeRoster(10), createSeededRng(1))
    expect(visit.rerollsRemaining).toBe(0)
  })

  it('grants SHOP_EXPANDED_REROLLS rerolls on the expanded tier', () => {
    const visit = openShopVisit('expanded', makeRoster(10), createSeededRng(1))
    expect(visit.rerollsRemaining).toBe(SHOP_EXPANDED_REROLLS)
  })
})
