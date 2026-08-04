import { SEASONS_PER_STRETCH } from '../../run/constants'
import type { RunBundle } from '../../data/persistence/runRepository'
import { TeamSummary } from '../components/TeamSummary'

export function TeamRevealScreen({ bundle, onBeginSeason }: { bundle: RunBundle; onBeginSeason: () => void }) {
  const { run, teams, players } = bundle
  const team = teams.find((t) => t.id === run.teamId)
  if (!team) return null

  const roster = players.filter((p) => p.teamId === team.id)
  const targetPct = Math.round(run.target.rankFraction * 100)

  return (
    <main>
      <h1>
        {team.city} {team.name}
      </h1>
      <p>
        Stretch {run.stretchNumber}, Season {run.seasonInStretch} of {SEASONS_PER_STRETCH}. Finish top {targetPct}% of
        standings or it&apos;s over.
      </p>
      <TeamSummary team={team} roster={roster} />
      <button className="primary" onClick={onBeginSeason}>
        Begin Season
      </button>
    </main>
  )
}
