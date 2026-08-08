import type { RunBundle } from '../../data/persistence/runRepository'

/**
 * Confirmation gate for quitting a run. A screen rather than a native confirm() or a modal: the app
 * has no modal layer, every other decision point here is a screen, and the choice deserves the room
 * to say what's actually being thrown away.
 *
 * The run is deleted outright -- there's no run history to archive into -- so this states the
 * survived-seasons line the Fired epilogue would have shown, since abandoning means never seeing it.
 */
export function AbandonRunScreen({
  bundle,
  onAbandon,
  onCancel,
}: {
  bundle: RunBundle
  onAbandon: () => void
  onCancel: () => void
}) {
  const { run, teams } = bundle
  const team = teams.find((t) => t.id === run.teamId)

  return (
    <main>
      <h1>Abandon This Run?</h1>
      <p>
        {team ? `${team.city} ${team.name} -- ` : ''}
        {run.seasonsPlayed} season{run.seasonsPlayed === 1 ? '' : 's'} survived, currently Stretch {run.stretchNumber},
        season {run.seasonInStretch} of {run.seasonsPerStretch}, with ${run.budget} left in the budget.
      </p>
      <p className="text-negative">
        This deletes the run. The roster, every camp and upgrade you bought, and the seasons you
        survived are gone for good -- there&apos;s no way back to it.
      </p>
      <div className="stretch-actions">
        <button className="primary" onClick={onCancel}>
          Keep Coaching
        </button>
        <button className="danger" onClick={onAbandon}>
          Abandon Run
        </button>
      </div>
    </main>
  )
}
