import type { Game, GameId, TeamId } from '../data/types'
import { SEASON_CHUNK_COUNT } from './constants'

/** [start, end) index range into a season's games array for one chunk. */
export interface SeasonChunkRange {
  start: number
  end: number
}

/**
 * Splits `totalGames` into `chunkCount` as-even-as-possible ranges, front-loading the remainder
 * (e.g. 33 games / 4 chunks -> 9/8/8/8, not 8/8/8/9) so the boundary the GM plans around never
 * moves due to a season length that doesn't divide evenly. RUN_SEASON_LENGTH (32) / SEASON_CHUNK_COUNT
 * (4) divides evenly today, but this doesn't assume that stays true.
 */
export function seasonChunkBoundaries(totalGames: number, chunkCount: number): SeasonChunkRange[] {
  const baseSize = Math.floor(totalGames / chunkCount)
  const remainder = totalGames % chunkCount

  const ranges: SeasonChunkRange[] = []
  let cursor = 0
  for (let i = 0; i < chunkCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0)
    ranges.push({ start: cursor, end: cursor + size })
    cursor += size
  }
  return ranges
}

/** One chunk's [start, end) range at the run's fixed SEASON_CHUNK_COUNT -- the split every caller
 *  outside seasonChunkBoundaries' own tests actually wants. Indices rather than the games
 *  themselves, since resolving a game means writing it back into the season array by position. */
export function chunkRange(totalGames: number, chunkInSeason: number): SeasonChunkRange {
  return seasonChunkBoundaries(totalGames, SEASON_CHUNK_COUNT)[chunkInSeason]
}

/** The slice of a season's games belonging to one chunk. */
export function chunkGames(games: Game[], chunkInSeason: number): Game[] {
  const { start, end } = chunkRange(games.length, chunkInSeason)
  return games.slice(start, end)
}

/**
 * Just the GM's own games out of a chunk, in calendar order -- what the stretch screen lists and
 * offers to simulate one at a time. Round-robin scheduling puts every team in exactly one game per
 * round, so this is reliably an even share of the chunk rather than a variable handful.
 *
 * AI-vs-AI games are excluded deliberately: they generate no Coaching Insights (resolveGame filters
 * to the run team) and involve no roster the GM knows, so there's nothing to watch. They're played
 * in bulk when the stretch opens instead.
 */
export function runTeamChunkGames(games: Game[], chunkInSeason: number, teamId: TeamId): Game[] {
  return chunkGames(games, chunkInSeason).filter((game) => game.homeTeamId === teamId || game.awayTeamId === teamId)
}

/**
 * The one game in this chunk the GM is allowed to resolve next: the earliest of their own that
 * hasn't been played. Null once the chunk is finished.
 *
 * A season is played in order. Nothing in the engine forced that before -- the stretch screen
 * offered Sim and Watch on every game at once, so a GM could resolve game 5 before game 2 or
 * cherry-pick around a hard opponent. Harmless while a game's only lasting effects were its own
 * result, but fatigue, injuries and in-game coaching decisions all carry *between* games, and none
 * of those mean anything if the order is arbitrary. Cheaper to establish the invariant now than to
 * retrofit it under systems that assume it.
 *
 * Deliberately derived rather than stored: no cursor to keep in sync with the games array, and a
 * save from before this rule -- where later games may already be played -- still resolves to
 * whatever is earliest and unplayed rather than getting stuck.
 */
export function nextPlayableGameId(games: Game[], chunkInSeason: number, teamId: TeamId): GameId | null {
  return runTeamChunkGames(games, chunkInSeason, teamId).find((game) => !game.isPlayed)?.id ?? null
}
