import { useCallback, useMemo, useRef, useState } from 'react'
import type { DefensiveSchemeId } from '../../data/presets'
import { BALANCED_FOCUS, type Game, type Player, type PlayerId, type TacticalFocus, type Team } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { defaultRng } from '../../engine/rng'
import { playGameLive } from '../../run/resolveGame'
import { resolveSynergyScore } from '../../run/teamSynergy'
import type { LiveGame } from '../state/runContext.core'
import { InspectorContext, type Inspector } from '../state/inspector.core'
import { BoxScoreTable } from '../components/BoxScoreTable'
import { DefensiveSchemeSelect } from '../components/DefensiveSchemeSelect'
import { TacticalFocusControls } from '../components/TacticalFocusControls'
import { formatOvertimeLabel } from '../formatOvertime'
import { CommentaryFeed } from '../simcast/CommentaryFeed'
import { LiveBoxScore } from '../simcast/LiveBoxScore'
import { OnCourtPanel } from '../simcast/OnCourtPanel'
import { Scoreboard } from '../simcast/Scoreboard'
import { SimcastPlayerCard } from '../simcast/SimcastPlayerCard'
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
  onSetDefensiveScheme,
  onSetTacticalFocus,
}: {
  bundle: RunBundle
  liveGame: LiveGame
  onCommit: (played: Game) => void
  onAbandon: () => void
  onSetDefensiveScheme: (schemeId: DefensiveSchemeId) => void
  onSetTacticalFocus: (focus: Partial<TacticalFocus>) => void
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
      onSetDefensiveScheme={onSetDefensiveScheme}
      onSetTacticalFocus={onSetTacticalFocus}
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
  onSetDefensiveScheme,
  onSetTacticalFocus,
}: {
  bundle: RunBundle
  game: Game
  homeTeam: Team
  awayTeam: Team
  playbackContext: PlaybackContext
  createSteps: () => ReturnType<typeof playGameLive>
  onCommit: (played: Game) => void
  onAbandon: () => void
  onSetDefensiveScheme: (schemeId: DefensiveSchemeId) => void
  onSetTacticalFocus: (focus: Partial<TacticalFocus>) => void
}) {
  const { run } = bundle
  const { state, status, finalGame, speed, setSpeed, togglePause, skipToEnd, acknowledgeOvertimePrompt, applyDirective } =
    useSimcastPlayback(playbackContext, createSteps)

  const userIsHome = game.homeTeamId === run.teamId
  const userTeam = userIsHome ? homeTeam : awayTeam
  const userRoster = userIsHome ? playbackContext.homeRoster : playbackContext.awayRoster

  /**
   * Which player's card is open over the broadcast, if any.
   *
   * Local to this screen rather than routed through App's viewingPlayerId, and that is forced: the
   * simcast holds its generator in a ref for the life of the screen, so App rendering a player page
   * instead would unmount it and lose the game. See Inspector.openTeam for the rest of that story.
   */
  const [inspectingId, setInspectingId] = useState<PlayerId | null>(null)
  // Whether closing the card should start the clock again -- true only if the game was actually
  // playing when it was opened, so opening a card during a pause doesn't resume on the way out.
  const resumeOnCloseRef = useRef(false)

  const openPlayer = useCallback(
    (playerId: PlayerId) => {
      // Paused while the card is up: at 1x a possession lands every 1.5 seconds, so reading a player
      // sheet otherwise means missing the game you chose to watch rather than sim.
      if (status === 'playing') {
        togglePause()
        resumeOnCloseRef.current = true
      }
      setInspectingId(playerId)
    },
    [status, togglePause],
  )

  const closePlayer = useCallback(() => {
    setInspectingId(null)
    if (resumeOnCloseRef.current) {
      resumeOnCloseRef.current = false
      togglePause()
    }
  }, [togglePause])

  // openTeam is null on purpose -- there is no team page to reach from inside a broadcast, and a
  // control that looks live and does nothing is worse than plain text.
  const inspector = useMemo<Inspector>(() => ({ openPlayer, openTeam: null }), [openPlayer])

  const inspectingPlayer = inspectingId ? (playbackContext.playerById.get(inspectingId) ?? null) : null
  // Both sides, so the feed can rule each possession in the colour of whoever had the ball.
  const liveGameTeams = useMemo(() => new Map([[homeTeam.id, homeTeam], [awayTeam.id, awayTeam]]), [homeTeam, awayTeam])

  /**
   * A scheme change made mid-broadcast has to land in two places, because they are genuinely two
   * things: the run's saved standing instruction, and the game already in flight -- whose generator
   * captured the team as it was at the opening tip and cannot see a later save.
   *
   * Read back off the bundle rather than held in local state, so the control shows the value that
   * was actually persisted rather than an optimistic one.
   */
  const handleDefensiveScheme = useCallback(
    (schemeId: DefensiveSchemeId) => {
      applyDirective({ kind: 'defensive-scheme', teamId: run.teamId, schemeId })
      onSetDefensiveScheme(schemeId)
    },
    [applyDirective, onSetDefensiveScheme, run.teamId],
  )

  const liveScheme = bundle.teams.find((t) => t.id === run.teamId)?.defensiveStrategyId ?? userTeam.defensiveStrategyId
  const liveTeam = bundle.teams.find((t) => t.id === run.teamId) ?? userTeam

  /**
   * A dial changed mid-broadcast, landing in the same two places a scheme change does -- with one
   * extra piece of freight.
   *
   * Shot selection changes the play-call mix, and synergy scores the roster against that mix, so the
   * running generator's synergy multiplier would otherwise go stale the moment the dial moved. The
   * engine cannot recompute it: computeInitialSynergyScore lives in `run/`, and `engine/` does not
   * import from there. So the score is resolved here -- where the roster and the playbook are both
   * in hand -- and travels with the directive. That is the same direction synergy already flows,
   * via Team.synergyScore; this is just the mid-game edition of it.
   */
  const handleTacticalFocus = useCallback(
    (partial: Partial<TacticalFocus>) => {
      const focus: TacticalFocus = { ...BALANCED_FOCUS, ...liveTeam.tacticalFocus, ...partial }
      const roster = bundle.players.filter((p) => p.teamId === liveTeam.id)
      const synergyScore = resolveSynergyScore(liveTeam, roster, run.coachingUpgrades, focus)
      applyDirective({ kind: 'tactical-focus', teamId: run.teamId, focus, synergyScore })
      onSetTacticalFocus(partial)
    },
    [applyDirective, bundle.players, liveTeam, onSetTacticalFocus, run.coachingUpgrades, run.teamId],
  )

  const handleContinue = useCallback(() => {
    if (finalGame) onCommit(finalGame)
  }, [finalGame, onCommit])

  const isFinal = status === 'final'
  // Decision 5 (rotation-charts.md Phase H): the sim already carries the Q4 closing five into
  // overtime on its own, so this is a beat to notice that happened, not a blocking decision --
  // Skip to Final stays available rather than being trapped behind an extra click.
  const isAwaitingOvertimePrompt = status === 'awaiting-substitutions'

  return (
    <InspectorContext.Provider value={inspector}>
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
          // Blank once the buzzer sounds -- "Final 0:00" reads like the clock is still running.
          clockLabel={isFinal ? '' : state.clockLabel}
          userTeamId={run.teamId}
        />

        {isAwaitingOvertimePrompt && (
          <p className="section-note">
            Overtime! The five that closed the fourth quarter carries on automatically -- hit Continue
            when you're ready.
          </p>
        )}

        <div className="simcast-controls">
          {isFinal ? (
            <button className="primary" onClick={handleContinue}>
              Continue
            </button>
          ) : isAwaitingOvertimePrompt ? (
            <>
              <button className="primary" onClick={acknowledgeOvertimePrompt}>
                Continue to Overtime
              </button>
              <button onClick={skipToEnd}>Skip to Final</button>
            </>
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

        {/* Live coaching, not a settings panel: available right up to the final buzzer and hidden
            after it, since nothing can still be changed about a game that's over. It applies from the
            next possession -- the one on screen has already been played and logged. */}
        {!isFinal && (
          <>
            <p className="section-note">
              <strong>Defense:</strong> <DefensiveSchemeSelect value={liveScheme} onChange={handleDefensiveScheme} /> -- takes effect from the
              next possession, and sticks for the rest of the run.
            </p>
            {/* The dials behave exactly like the scheme above, which is the whole of D2: same control,
                same "from the next possession", same value the checkpoint will show afterwards. */}
            <div className="section-note">
              <TacticalFocusControls focus={liveTeam.tacticalFocus} onChange={handleTacticalFocus} side="offense" />
              <TacticalFocusControls focus={liveTeam.tacticalFocus} onChange={handleTacticalFocus} side="defense" />
            </div>
          </>
        )}

        <div className="simcast-body">
          <section className="simcast-feed">
            <h2>Play-by-Play</h2>
            <CommentaryFeed feed={state.feed} userTeamId={run.teamId} teamsById={liveGameTeams} />
          </section>

          <aside className="simcast-floor">
            <OnCourtPanel
              label={`${awayTeam.abbreviation} on the floor`}
              onCourt={state.awayOnCourt}
              playerById={playbackContext.playerById}
              fatigue={state.fatigue}
              isUserTeam={!userIsHome}
            />
            <OnCourtPanel
              label={`${homeTeam.abbreviation} on the floor`}
              onCourt={state.homeOnCourt}
              playerById={playbackContext.playerById}
              fatigue={state.fatigue}
              isUserTeam={userIsHome}
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

        {inspectingPlayer && (
          <SimcastPlayerCard
            player={inspectingPlayer}
            isUserTeam={inspectingPlayer.teamId === run.teamId}
            teamLabel={(inspectingPlayer.teamId === homeTeam.id ? homeTeam : awayTeam).abbreviation}
            line={state.lines.get(inspectingPlayer.id)}
            fatigue={state.fatigue.get(inspectingPlayer.id) ?? 0}
            onClose={closePlayer}
          />
        )}
      </main>
    </InspectorContext.Provider>
  )
}
