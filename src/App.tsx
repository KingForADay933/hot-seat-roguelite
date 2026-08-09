import { useMemo, useState } from 'react'
import { RunProvider } from './ui/state/RunProvider'
import { useRun } from './ui/state/useRun'
import { AbandonRunScreen } from './ui/screens/AbandonRunScreen'
import { RunStartScreen } from './ui/screens/RunStartScreen'
import { RunDraftScreen } from './ui/screens/RunDraftScreen'
import { TeamRevealScreen } from './ui/screens/TeamRevealScreen'
import { ChunkResultsScreen } from './ui/screens/ChunkResultsScreen'
import { MyTeamScreen } from './ui/screens/MyTeamScreen'
import { SeasonResultsScreen } from './ui/screens/SeasonResultsScreen'
import { ShopScreen } from './ui/screens/ShopScreen'
import { FiredScreen } from './ui/screens/FiredScreen'
import { StretchScreen } from './ui/screens/StretchScreen'
import { SimcastScreen } from './ui/screens/SimcastScreen'
import { PlayerScreen } from './ui/screens/PlayerScreen'
import { PlayerInspectorContext } from './ui/state/playerInspector.core'
import type { PlayerId } from './data/types'

function AppContent() {
  // Whether the My Team reference sheet is covering the current screen. Local, not persisted:
  // it's a view toggle, and a refresh landing back on the screen that actually needs an action
  // (shop, checkpoint) is the better default anyway.
  const [viewingMyTeam, setViewingMyTeam] = useState(false)
  // Whether the abandon confirmation is up. Same local-view-toggle rationale as viewingMyTeam --
  // and deliberately not persisted, so a refresh mid-decision keeps the run rather than the prompt.
  const [confirmingAbandon, setConfirmingAbandon] = useState(false)
  // Which player's detail page is open, if any. Same local-view-toggle rationale as the two above.
  // Closing returns to whichever screen the name was clicked on -- My Team, a checkpoint, a
  // stretch -- rather than to the run's default screen. Like My Team it replaces that screen
  // rather than overlaying it, so the screen underneath remounts on the way back and its own view
  // state resets (an expanded box score returns collapsed).
  const [viewingPlayerId, setViewingPlayerId] = useState<PlayerId | null>(null)
  const inspector = useMemo(() => ({ openPlayer: setViewingPlayerId }), [])
  const {
    bundle,
    draft,
    reveal,
    loading,
    fireAcknowledged,
    liveGame,
    acknowledgeFired,
    abandonRun,
    beginDraft,
    confirmDraft,
    lockSystem,
    simSeasonChunk,
    beginStretch,
    simGame,
    watchGame,
    commitLiveGame,
    abandonLiveGame,
    finishStretch,
    setRotationMinutes,
    setTrainingFocus,
    setRotationPlan,
    openShop,
    buyPlayerCamp,
    buyTeamCamp,
    buyCoachingUpgrade,
    rerollUpgradeOffers,
    buyConsumable,
    rerollConsumableOffers,
    activateConsumable,
  } = useRun()

  if (loading) return <p>Loading…</p>
  // Run setup is two phases: the roster-shaping picks, then the reveal, where the system is chosen
  // against the roster those picks produced. Neither is persisted -- the run only exists once
  // lockSystem saves a bundle -- so both are checked before the saved-bundle branches below.
  if (draft) return <RunDraftScreen draft={draft} onConfirm={confirmDraft} />
  if (reveal) return <TeamRevealScreen mode="draft-system" reveal={reveal} onLockSystem={lockSystem} />
  if (!bundle) return <RunStartScreen onStart={beginDraft} />
  // A game being watched outranks everything below -- it's a mode the GM entered from the stretch
  // screen and leaves by finishing or abandoning, not a place the run state machine routes to.
  // Deliberately ahead of the My Team nav too: a simcast is the one screen the reference sheet
  // shouldn't cover, since the game is already in motion and nothing on it can still be changed.
  if (liveGame) {
    return <SimcastScreen bundle={bundle} liveGame={liveGame} onCommit={commitLiveGame} onAbandon={abandonLiveGame} />
  }

  const runScreen = () => {
    // An open stretch sits ahead of the checkpoint checks: run.chunkInSeason still points at the
    // chunk being played, so without this the half-finished chunk would render as its own result.
    if (bundle.stretchInProgress) {
      return <StretchScreen bundle={bundle} onSimGame={simGame} onWatchGame={watchGame} onFinish={finishStretch} />
    }
    // Nothing simulated yet in this run at all -- distinct from chunkInSeason alone, which also
    // reads 0 once a later season's chunk 4 has just wrapped up (see evaluateSeasonEnd).
    if (bundle.run.seasonsPlayed === 0 && bundle.run.chunkInSeason === 0) {
      return <TeamRevealScreen mode="locked" bundle={bundle} onBeginSeason={beginStretch} onSimSeason={simSeasonChunk} />
    }
    // The season that got the GM fired still gets its own results recap -- just no shop, since
    // there's no next season left to spend the budget in. fireAcknowledged gates it to once.
    if (bundle.run.status === 'fired' && fireAcknowledged) return <FiredScreen bundle={bundle} onNewRun={beginDraft} />
    if (bundle.shop) {
      return (
        <ShopScreen
          bundle={bundle}
          onBuyPlayerCamp={buyPlayerCamp}
          onBuyTeamCamp={buyTeamCamp}
          onBuyCoachingUpgrade={buyCoachingUpgrade}
          onRerollUpgradeOffers={rerollUpgradeOffers}
          onBuyConsumable={buyConsumable}
          onRerollConsumableOffers={rerollConsumableOffers}
          onActivateConsumable={activateConsumable}
          onContinue={beginStretch}
          onSimSeason={simSeasonChunk}
        />
      )
    }
    // chunkInSeason > 0 means a non-final chunk (Section 9) just played -- the season isn't over yet.
    if (bundle.run.chunkInSeason > 0) {
      return (
        <ChunkResultsScreen
          bundle={bundle}
          onContinue={beginStretch}
          onSimStretch={simSeasonChunk}
          onSetMinutes={setRotationMinutes}
          onSetFocus={setTrainingFocus}
        />
      )
    }
    return <SeasonResultsScreen bundle={bundle} onContinue={bundle.run.status === 'fired' ? acknowledgeFired : openShop} />
  }

  // Above every run screen but below the simcast: a player page is a reference sheet, and a game
  // already in motion outranks looking someone up. Rendered before the My Team check so opening a
  // name from there returns to My Team rather than dropping back to the run.
  if (viewingPlayerId) {
    return (
      <PlayerInspectorContext.Provider value={inspector}>
        <PlayerScreen bundle={bundle} playerId={viewingPlayerId} onBack={() => setViewingPlayerId(null)} />
      </PlayerInspectorContext.Provider>
    )
  }

  if (confirmingAbandon) {
    return (
      <AbandonRunScreen
        bundle={bundle}
        onAbandon={() => {
          setConfirmingAbandon(false)
          void abandonRun()
        }}
        onCancel={() => setConfirmingAbandon(false)}
      />
    )
  }
  if (viewingMyTeam) {
    return (
      <PlayerInspectorContext.Provider value={inspector}>
        <MyTeamScreen
          bundle={bundle}
          onSetMinutes={setRotationMinutes}
          onSetFocus={setTrainingFocus}
          onSetRotationPlan={setRotationPlan}
          onBack={() => setViewingMyTeam(false)}
        />
      </PlayerInspectorContext.Provider>
    )
  }

  // Every screen of a live run gets the same entry points -- the roster sheet informs shop buys,
  // rotation changes and "do I bother" reads alike, and quitting shouldn't require reaching a
  // particular screen either. Both sit behind the simcast check above, so neither interrupts a
  // game already in motion.
  return (
    <PlayerInspectorContext.Provider value={inspector}>
      <nav>
        <button onClick={() => setViewingMyTeam(true)}>My Team</button>
        <button className="link-button nav-quit" onClick={() => setConfirmingAbandon(true)}>
          Abandon Run
        </button>
      </nav>
      {runScreen()}
    </PlayerInspectorContext.Provider>
  )
}

function App() {
  return (
    <RunProvider>
      <AppContent />
    </RunProvider>
  )
}

export default App
