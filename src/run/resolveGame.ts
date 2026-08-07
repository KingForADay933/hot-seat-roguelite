import type { Game, Team } from '../data/types'
import { generateCoachingInsights, type CoachingInsight } from '../engine/insights/generateCoachingInsights'
import type { Rng } from '../engine/rng'
import { simulateGame, simulateGameSteps, type SimulationStep } from '../engine/simulateGame'
import type { ChunkSimContext } from './chunkSimContext'
import type { RunState } from './types'

/** Section 9: Coaching Insights are pulled from the possession log as a game resolves, then the log
 *  is dropped -- nothing downstream needs possession-level detail, and keeping 128 games' worth of
 *  it would bloat every save. */
function stripPossessionLog(game: Game): Game {
  return { ...game, possessionLog: [] }
}

function resolveTeams(context: ChunkSimContext, game: Game): { homeTeam: Team; awayTeam: Team } {
  const homeTeam = context.teamsById.get(game.homeTeamId)
  const awayTeam = context.teamsById.get(game.awayTeamId)
  if (!homeTeam || !awayTeam) throw new Error(`Game ${game.id} references a team not in this league`)
  return { homeTeam, awayTeam }
}

export interface ResolvedGame {
  /** The played game, log already stripped -- ready to slot straight back into the season's games[]. */
  game: Game
  /** Insights about the run team from this game alone. Empty for an AI-vs-AI game, and empty for a
   *  run-team game with nothing notable in it -- the caller accumulates these across the chunk and
   *  dedupes at the checkpoint (finalizeChunk). */
  insights: CoachingInsight[]
}

/**
 * Plays exactly one scheduled game and harvests its Coaching Insights.
 *
 * `alreadyPlayed` lets a game that was watched live (SimcastScreen, which drives playGameLive below)
 * be folded in as-is rather than re-simulated. That distinction matters: defaultRng is Math.random,
 * so re-simulating would produce a different game than the one the GM just watched. Whatever is
 * passed here must still carry its possession log -- insights come out of it before it's stripped.
 */
export function resolveGame(context: ChunkSimContext, run: RunState, scheduled: Game, rng: Rng, alreadyPlayed?: Game): ResolvedGame {
  const { homeTeam, awayTeam } = resolveTeams(context, scheduled)
  const played = alreadyPlayed ?? simulateGame(scheduled, homeTeam, awayTeam, context.playersById, context.possessionsPerGame, rng)

  const involvesRunTeam = played.homeTeamId === run.teamId || played.awayTeamId === run.teamId
  const insights = involvesRunTeam
    ? generateCoachingInsights(played.possessionLog, homeTeam, awayTeam, context.playersById, context.possessionsPerGame).filter(
        (insight) => insight.teamId === run.teamId,
      )
    : []

  return { game: stripPossessionLog(played), insights }
}

/**
 * The same game resolveGame would play, but handed back one possession at a time so the UI can
 * reveal it as it happens (Section 14.2's Live Playback) instead of all at once. Drain it and the
 * returned Game is exactly what a plain resolveGame call would have produced -- feed that back in as
 * `alreadyPlayed` to commit it.
 *
 * Deliberately a generator rather than "simulate everything, then animate the log": pausing between
 * possessions is where interactive coaching decisions (timeouts, subs, emphasis changes) will hook
 * in, and that pause point only exists if the rest of the game genuinely hasn't happened yet.
 */
export function playGameLive(context: ChunkSimContext, scheduled: Game, rng: Rng): Generator<SimulationStep, Game> {
  const { homeTeam, awayTeam } = resolveTeams(context, scheduled)
  return simulateGameSteps(scheduled, homeTeam, awayTeam, context.playersById, context.possessionsPerGame, rng)
}
