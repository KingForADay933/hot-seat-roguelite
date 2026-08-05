import { RunProvider } from './ui/state/RunProvider'
import { useRun } from './ui/state/useRun'
import { RunStartScreen } from './ui/screens/RunStartScreen'
import { RunDraftScreen } from './ui/screens/RunDraftScreen'
import { TeamRevealScreen } from './ui/screens/TeamRevealScreen'
import { SeasonResultsScreen } from './ui/screens/SeasonResultsScreen'
import { ShopScreen } from './ui/screens/ShopScreen'
import { FiredScreen } from './ui/screens/FiredScreen'

function AppContent() {
  const { bundle, draft, loading, beginDraft, confirmDraft, simSeason, openShop, buyShopOffer, rerollShop } = useRun()

  if (loading) return <p>Loading…</p>
  if (draft) return <RunDraftScreen draft={draft} onConfirm={confirmDraft} />
  if (!bundle) return <RunStartScreen onStart={beginDraft} />
  if (bundle.run.seasonsPlayed === 0) return <TeamRevealScreen bundle={bundle} onBeginSeason={simSeason} />
  if (bundle.run.status === 'fired') return <FiredScreen bundle={bundle} onNewRun={beginDraft} />
  if (bundle.shop) return <ShopScreen bundle={bundle} onBuy={buyShopOffer} onReroll={rerollShop} onContinue={simSeason} />
  return <SeasonResultsScreen bundle={bundle} onContinue={openShop} />
}

function App() {
  return (
    <RunProvider>
      <AppContent />
    </RunProvider>
  )
}

export default App
