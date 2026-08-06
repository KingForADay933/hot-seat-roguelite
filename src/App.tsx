import { RunProvider } from './ui/state/RunProvider'
import { useRun } from './ui/state/useRun'
import { RunStartScreen } from './ui/screens/RunStartScreen'
import { RunDraftScreen } from './ui/screens/RunDraftScreen'
import { TeamRevealScreen } from './ui/screens/TeamRevealScreen'
import { ChunkResultsScreen } from './ui/screens/ChunkResultsScreen'
import { SeasonResultsScreen } from './ui/screens/SeasonResultsScreen'
import { ShopScreen } from './ui/screens/ShopScreen'
import { FiredScreen } from './ui/screens/FiredScreen'

function AppContent() {
  const {
    bundle,
    draft,
    loading,
    fireAcknowledged,
    acknowledgeFired,
    beginDraft,
    confirmDraft,
    simSeasonChunk,
    setRotationMinutes,
    setTrainingFocus,
    openShop,
    buyShopOffer,
    rerollShop,
  } = useRun()

  if (loading) return <p>Loading…</p>
  if (draft) return <RunDraftScreen draft={draft} onConfirm={confirmDraft} />
  if (!bundle) return <RunStartScreen onStart={beginDraft} />
  // Nothing simulated yet in this run at all -- distinct from chunkInSeason alone, which also
  // reads 0 once a later season's chunk 4 has just wrapped up (see evaluateSeasonEnd).
  if (bundle.run.seasonsPlayed === 0 && bundle.run.chunkInSeason === 0) {
    return <TeamRevealScreen bundle={bundle} onBeginSeason={simSeasonChunk} />
  }
  // The season that got the GM fired still gets its own results recap -- just no shop, since
  // there's no next season left to spend the budget in. fireAcknowledged gates it to once.
  if (bundle.run.status === 'fired' && fireAcknowledged) return <FiredScreen bundle={bundle} onNewRun={beginDraft} />
  if (bundle.shop) return <ShopScreen bundle={bundle} onBuy={buyShopOffer} onReroll={rerollShop} onContinue={simSeasonChunk} />
  // chunkInSeason > 0 means a non-final chunk (Section 9) just played -- the season isn't over yet.
  if (bundle.run.chunkInSeason > 0) {
    return <ChunkResultsScreen bundle={bundle} onContinue={simSeasonChunk} onSetMinutes={setRotationMinutes} onSetFocus={setTrainingFocus} />
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
