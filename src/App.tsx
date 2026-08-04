import { RunProvider } from './ui/state/RunProvider'
import { useRun } from './ui/state/useRun'
import { RunStartScreen } from './ui/screens/RunStartScreen'
import { TeamRevealScreen } from './ui/screens/TeamRevealScreen'
import { SeasonResultsScreen } from './ui/screens/SeasonResultsScreen'
import { FiredScreen } from './ui/screens/FiredScreen'

function AppContent() {
  const { bundle, loading, startNewRun, simSeason } = useRun()

  if (loading) return <p>Loading…</p>
  if (!bundle) return <RunStartScreen onStart={startNewRun} />
  if (bundle.run.seasonsPlayed === 0) return <TeamRevealScreen bundle={bundle} onBeginSeason={simSeason} />
  if (bundle.run.status === 'fired') return <FiredScreen bundle={bundle} onNewRun={startNewRun} />
  return <SeasonResultsScreen bundle={bundle} onNextSeason={simSeason} />
}

function App() {
  return (
    <RunProvider>
      <AppContent />
    </RunProvider>
  )
}

export default App
