import type { RunBundle } from '../../data/persistence/runRepository'

export function FiredScreen({ bundle, onNewRun }: { bundle: RunBundle; onNewRun: () => void }) {
  const { run, teams } = bundle
  const team = teams.find((t) => t.id === run.teamId)

  return (
    <main>
      <h1>Fired</h1>
      <p>
        {team ? `${team.city} ${team.name} let you go. ` : ''}
        You survived {run.seasonsPlayed} season{run.seasonsPlayed === 1 ? '' : 's'}, reaching Stretch {run.stretchNumber}, with ${run.budget}{' '}
        left in the budget.
      </p>
      <button className="primary" onClick={onNewRun}>
        Start New Run
      </button>
    </main>
  )
}
