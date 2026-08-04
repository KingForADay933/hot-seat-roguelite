import type { RunBundle } from '../../data/persistence/runRepository'
import { SEASONS_PER_STRETCH } from '../../run/constants'
import { StandingsTable } from '../components/StandingsTable'
import { TeamSummary } from '../components/TeamSummary'

export function SeasonResultsScreen({ bundle, onNextSeason }: { bundle: RunBundle; onNextSeason: () => void }) {
  const { run, league, teams, players, lastSeasonTargetHit } = bundle
  const completedSeason = league.seasonHistory[league.seasonHistory.length - 1]
  const team = teams.find((t) => t.id === run.teamId)
  if (!completedSeason || !team) return null

  const roster = players.filter((p) => p.teamId === team.id)
  const record = completedSeason.standings.find((row) => row.teamId === run.teamId)
  const targetPct = Math.round(run.target.rankFraction * 100)

  return (
    <main>
      <h1>
        Season {completedSeason.seasonNumber} Results — {team.city} {team.name}
      </h1>
      {lastSeasonTargetHit ? (
        <p className="text-positive">
          Target hit. The board's raising the bar — Stretch {run.stretchNumber} begins, top {targetPct}% now required.
        </p>
      ) : (
        <p className="text-negative">
          Missed it. Season {run.seasonInStretch} of {SEASONS_PER_STRETCH} this stretch is next — same top {targetPct}%
          target.
        </p>
      )}
      <TeamSummary team={team} roster={roster} record={record} />
      <h2>Final Standings</h2>
      <StandingsTable rows={completedSeason.standings} teams={teams} userTeamId={run.teamId} />
      <button className="primary" onClick={onNextSeason}>
        Sim Next Season
      </button>
    </main>
  )
}
