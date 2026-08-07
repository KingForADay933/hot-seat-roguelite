import type { Game, League, Player, Team } from '../data/types'
import type { CoachingInsight } from '../engine/insights/generateCoachingInsights'
import type { Rng } from '../engine/rng'
import { beginSeason } from './beginSeason'
import { createChunkSimContext } from './chunkSimContext'
import { SEASON_CHUNK_COUNT } from './constants'
import { finalizeChunk, type ChunkOutcome } from './finalizeChunk'
import { resolveGame } from './resolveGame'
import { seasonChunkBoundaries } from './seasonChunks'
import type { RunState } from './types'
import type { WildcardEventOutcome } from './variation/wildcardEvents'

export interface SeasonChunkResult extends ChunkOutcome {
  /** Non-null only on the chunk that rolled it (always chunk index 0, a season's first) -- null on
   *  every other chunk, including the season-ending one if that's not also the first. */
  wildcardEvent: WildcardEventOutcome | null
}

/**
 * Simulates one whole chunk of the CURRENT (or, at chunkInSeason 0, a brand new) season in a single
 * call: run.chunkInSeason says which chunk is next. A fresh season additionally rolls that season's
 * wildcard event and generates its full schedule (beginSeason) before simming chunk 0's slice of it.
 *
 * This is the batch path -- the GM chose not to watch anything, so all of the chunk's games resolve
 * at once. The stretch screen's per-game path reaches the same checkpoint by calling the same three
 * pieces (beginSeason, resolveGame, finalizeChunk) at its own pace instead; keeping both flows on
 * those shared pieces is what stops the two from drifting apart.
 */
export function simulateSeasonChunk(run: RunState, league: League, teams: Team[], players: Player[], games: Game[], rng: Rng): SeasonChunkResult {
  let seasonPlayers = players
  let seasonGames = games
  let wildcardEvent: WildcardEventOutcome | null = null

  if (run.chunkInSeason === 0) {
    const started = beginSeason(run, league, players, rng)
    seasonPlayers = started.players
    seasonGames = started.games
    wildcardEvent = started.wildcardEvent
  }

  const context = createChunkSimContext(run, league, teams, seasonPlayers)
  const { start, end } = seasonChunkBoundaries(seasonGames.length, SEASON_CHUNK_COUNT)[run.chunkInSeason]

  const insights: CoachingInsight[] = []
  const updatedGames = [...seasonGames]
  for (let i = start; i < end; i++) {
    const resolved = resolveGame(context, run, seasonGames[i], rng)
    updatedGames[i] = resolved.game
    insights.push(...resolved.insights)
  }

  return { ...finalizeChunk(run, league, teams, seasonPlayers, updatedGames, insights), wildcardEvent }
}
