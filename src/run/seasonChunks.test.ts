import { describe, expect, it } from 'vitest'
import type { Game } from '../data/types'
import { nextPlayableGameId, seasonChunkBoundaries } from './seasonChunks'

describe('seasonChunkBoundaries', () => {
  it('splits an evenly-divisible game count into equal contiguous ranges', () => {
    expect(seasonChunkBoundaries(32, 4)).toEqual([
      { start: 0, end: 8 },
      { start: 8, end: 16 },
      { start: 16, end: 24 },
      { start: 24, end: 32 },
    ])
  })

  it('front-loads the remainder when the game count does not divide evenly', () => {
    expect(seasonChunkBoundaries(33, 4)).toEqual([
      { start: 0, end: 9 },
      { start: 9, end: 17 },
      { start: 17, end: 25 },
      { start: 25, end: 33 },
    ])
  })

  it('covers every game exactly once, in order, with no gaps or overlaps', () => {
    const ranges = seasonChunkBoundaries(37, 4)
    expect(ranges[0].start).toBe(0)
    expect(ranges[ranges.length - 1].end).toBe(37)
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].start).toBe(ranges[i - 1].end)
    }
  })

  it('handles a single chunk as the whole season', () => {
    expect(seasonChunkBoundaries(32, 1)).toEqual([{ start: 0, end: 32 }])
  })
})

/**
 * A season is played in order (Tier 1.5). These cover the rule itself; the stretch screen and
 * RunProvider both read this one function, so there's a single definition of "next" to test.
 */
describe('nextPlayableGameId', () => {
  /** 32 games, so chunk 0 is indices 0-7. Alternates the user team in and out so the chunk holds a
   *  realistic mix of their games and AI-vs-AI ones. */
  function buildSeason(playedIds: string[] = []): Game[] {
    return Array.from({ length: 32 }, (_, i) => ({
      id: `game-${i}`,
      leagueId: 'league-1',
      homeTeamId: i % 2 === 0 ? 'user' : 'other-a',
      awayTeamId: i % 2 === 0 ? 'other-b' : 'other-c',
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      isPlayed: playedIds.includes(`game-${i}`),
      result: null,
      possessionLog: [],
      isSaved: false,
    })) as Game[]
  }

  it('is the first of the run team s games in the chunk when nothing has been played', () => {
    expect(nextPlayableGameId(buildSeason(), 0, 'user')).toBe('game-0')
  })

  it('skips games the run team is not involved in', () => {
    // game-1 is other-a vs other-c; the user's next is game-2, not game-1.
    expect(nextPlayableGameId(buildSeason(['game-0']), 0, 'user')).toBe('game-2')
  })

  it('advances as games are played', () => {
    expect(nextPlayableGameId(buildSeason(['game-0', 'game-2']), 0, 'user')).toBe('game-4')
  })

  it('is null once every one of the run team s games in the chunk is played', () => {
    expect(nextPlayableGameId(buildSeason(['game-0', 'game-2', 'game-4', 'game-6']), 0, 'user')).toBeNull()
  })

  it('stays inside its own chunk rather than running on into the next one', () => {
    // Chunk 0 fully played; chunk 0 is done even though chunk 1's games are still open.
    const played = ['game-0', 'game-2', 'game-4', 'game-6']
    expect(nextPlayableGameId(buildSeason(played), 0, 'user')).toBeNull()
    expect(nextPlayableGameId(buildSeason(played), 1, 'user')).toBe('game-8')
  })

  it('recovers on a save where a later game was already played out of order', () => {
    // The rule didn't exist when this run started, so game-4 got resolved before game-0. The
    // earliest still-unplayed game is what's next -- no stored cursor to get stuck.
    expect(nextPlayableGameId(buildSeason(['game-4']), 0, 'user')).toBe('game-0')
  })
})
