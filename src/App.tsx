import { RunProvider } from './ui/state/RunProvider'
import { useRun } from './ui/state/useRun'
import { RunStartScreen } from './ui/screens/RunStartScreen'
import { RunDraftScreen } from './ui/screens/RunDraftScreen'
import { TeamRevealScreen } from './ui/screens/TeamRevealScreen'
import { ChunkResultsScreen } from './ui/screens/ChunkResultsScreen'
import { SeasonResultsScreen } from './ui/screens/SeasonResultsScreen'
import { ShopScreen } from './ui/screens/ShopScreen'
import { FiredScreen } from './ui/screens/FiredScreen'
import { StretchScreen } from './ui/screens/StretchScreen'
import { SimcastScreen } from './ui/screens/SimcastScreen'

function AppContent() {
  const {
    bundle,
    draft,
    reveal,
    loading,
    fireAcknowledged,
    liveGame,
    acknowledgeFired,
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
  if (liveGame) {
    return <SimcastScreen bundle={bundle} liveGame={liveGame} onCommit={commitLiveGame} onAbandon={abandonLiveGame} />
  }
  // An open stretch likewise sits ahead of the checkpoint checks: run.chunkInSeason still points at
  // the chunk being played, so without this the half-finished chunk would render as its own result.
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

function App() {
  return (
    <RunProvider>
      <AppContent />
    </RunProvider>
  )
}

export default App
