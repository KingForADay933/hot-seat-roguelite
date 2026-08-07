import { useCallback, useMemo } from 'react'
import type { Game, Player, Team } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { defaultRng } from '../../engine/rng'
import { playGameLive } from '../../run/resolveGame'
import type { LiveGame } from '../state/runContext.core'
import { BoxScoreTable } from '../components/BoxScoreTable'
import { formatOvertimeLabel } from '../formatOvertime'
import { CommentaryFeed } from '../simcast/CommentaryFeed'
import { LiveBoxScore } from '../simcast/LiveBoxScore'
import { OnCourtPanel } from '../simcast/OnCourtPanel'
import { Scoreboard } from '../simcast/Scoreboard'
import type { PlaybackContext } from '../simcast/playbackState'
import { PLAYBACK_SPEEDS, useSimcastPlayback, type PlaybackSpeed } from '../simcast/useSimcastPlayback'

function resolveRoster(team: Team, playerById: Map<string, Player>): Player[] {
  return team.rosterPlayerIds.map((id) => playerById.get(id)).filter((p): p is Player => p !== undefined)
}

export function SimcastScreen({
  bundle,
  liveGame,
  onCommit,
  onAbandon,
}: {
  bundle: RunBundle
  liveGame: LiveGame
  onCommit: (played: Game) => void
  onAbandon: () => void
}) {
  const { game, context } = liveGame
  const homeTeam = context.teamsById.get(game.homeTeamId)
  const awayTeam = context.teamsById.get(game.awayTeamId)

  const playbackContext = useMemo<PlaybackContext | null>(() => {
    if (!homeTeam || !awayTeam) return null
    return {
      homeRoster: resolveRoster(homeTeam, context.playersById),
      awayRoster: resolveRoster(awayTeam, context.playersById),
      playerById: context.playersById,
      possessionsPerGame: context.possessionsPerGame,
    }
  }, [homeTeam, awayTeam, context])

  if (!homeTeam || !awayTeam || !playbackContext) return null

  return (
    <SimcastBroadcast
      bundle={bundle}
      game={game}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      playbackContext={playbackContext}
      createSteps={() => playGameLive(context, game, defaultRng)}
      onCommit={onCommit}
      onAbandon={onAbandon}
    />
  )
}

/** Split from SimcastScreen so the playback hook only ever mounts once both teams have resolved --
 *  a hook can't sit behind the early return above. */
function SimcastBroadcast({
  bundle,
  game,
  homeTeam,
  awayTeam,
  playbackContext,
  createSteps,
  onCommit,
  onAbandon,
}: {
  bundle: RunBundle
  game: Game
  homeTeam: Team
  awayTeam: Team
  playbackContext: PlaybackContext
  createSteps: () => ReturnType<typeof playGameLive>
  onCommit: (played: Game) => void
  onAbandon: () => void
}) {
  const { run } = bundle
  const { state, status, finalGame, speed, setSpeed, togglePause, skipToEnd } = useSimcastPlayback(playbackContext, createSteps)

  const userIsHome = game.homeTeamId === run.teamId
  const userTeam = userIsHome ? homeTeam : awayTeam
  const userRoster = userIsHome ? playbackContext.homeRoster : playbackContext.awayRoster

  const handleContinue = useCallback(() => {
    if (finalGame) onCommit(finalGame)
  }, [finalGame, onCommit])

  const isFinal = status === 'final'

  return (
    <main>
      <h1>
        {awayTeam.abbreviation} @ {homeTeam.abbreviation}
      </h1>

      <Scoreboard
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeScore={state.homeScore}
        awayScore={state.awayScore}
        periodLabel={isFinal ? `Final${formatOvertimeLabel(finalGame?.result?.overtimePeriods ?? 0)}` : state.periodLabel}
        userTeamId={run.teamId}
      />

      <div className="simcast-controls">
        {isFinal ? (
          <button className="primary" onClick={handleContinue}>
            Continue
          </button>
        ) : (
          <>
            <button onClick={togglePause}>{status === 'playing' ? 'Pause' : 'Resume'}</button>
            {PLAYBACK_SPEEDS.map((option) => (
              <button
                key={option}
                onClick={() => setSpeed(option as PlaybackSpeed)}
                disabled={speed === option}
                aria-pressed={speed === option}
              >
                {option}x
              </button>
            ))}
            <button onClick={skipToEnd}>Skip to Final</button>
            {/* Nothing has been committed yet, so leaving here genuinely un-plays the game -- it
                goes back to the stretch screen unresolved rather than half-recorded. */}
            <button className="link-button" onClick={onAbandon}>
              Leave without playing
            </button>
          </>
        )}
      </div>

      <div className="simcast-body">
        <section className="simcast-feed">
          <h2>Play-by-Play</h2>
          <CommentaryFeed feed={state.feed} userTeamId={run.teamId} />
        </section>

        <aside className="simcast-floor">
          <OnCourtPanel
            label={`${awayTeam.abbreviation} on the floor`}
            onCourtIds={state.awayOnCourtIds}
            playerById={playbackContext.playerById}
            fatigue={state.fatigue}
          />
          <OnCourtPanel
            label={`${homeTeam.abbreviation} on the floor`}
            onCourtIds={state.homeOnCourtIds}
            playerById={playbackContext.playerById}
            fatigue={state.fatigue}
          />
        </aside>
      </div>

      <h2>
        {userTeam.abbreviation} {isFinal ? 'Box Score' : 'Box Score (live)'}
      </h2>
      {isFinal && finalGame?.result ? (
        <BoxScoreTable lines={userIsHome ? finalGame.result.boxScore.home : finalGame.result.boxScore.away} players={userRoster} />
      ) : (
        <LiveBoxScore roster={userRoster} lines={state.lines} />
      )}
    </main>
  )
}
