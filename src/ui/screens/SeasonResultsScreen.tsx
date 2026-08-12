import type { RunBundle } from '../../data/persistence/runRepository'
import type { StandingsRow } from '../../data/types'
import { StandingsTable } from '../components/StandingsTable'
import { StatCallouts } from '../components/StatCallouts'
import { TeamSummary } from '../components/TeamSummary'
import { ScreenActions } from '../components/ScreenActions'

/** Signed, per game, one decimal -- the same form the standings table quotes a margin in, so the
 *  callout and the table underneath it never disagree. */
function formatMargin(row: StandingsRow): string {
  const played = row.wins + row.losses
  if (played === 0) return '--'
  const margin = row.pointDiff / played
  return `${margin > 0 ? '+' : ''}${margin.toFixed(1)}`
}

export function SeasonResultsScreen({ bundle, onContinue }: { bundle: RunBundle; onContinue: () => void }) {
  const { run, league, teams, players, lastSeasonTargetHit, lastWildcardEvent, lastBudgetEarned } = bundle
  const completedSeason = league.seasonHistory[league.seasonHistory.length - 1]
  const team = teams.find((t) => t.id === run.teamId)
  if (!completedSeason || !team) return null

  const roster = players.filter((p) => p.teamId === team.id)
  const record = completedSeason.standings.find((row) => row.teamId === run.teamId)
  const targetPct = Math.round(run.target.rankFraction * 100)
  const rank = completedSeason.standings.findIndex((row) => row.teamId === run.teamId) + 1

  return (
    <main>
      <ScreenActions>
        <button className="primary" onClick={onContinue}>
          {run.status === 'fired' ? 'Continue' : 'Continue to Shop'}
        </button>
      </ScreenActions>

      <h1>
        Season {completedSeason.seasonNumber} Results — {team.city} {team.name}
      </h1>
      {lastSeasonTargetHit ? (
        <p className="text-positive">
          Target hit. The board's raising the bar — Stretch {run.stretchNumber} begins, top {targetPct}% now required.
        </p>
      ) : run.status === 'fired' ? (
        <p className="text-negative">Missed it. That was the last chance this stretch -- the board's letting you go.</p>
      ) : (
        <p className="text-negative">
          Missed it. Season {run.seasonInStretch} of {run.seasonsPerStretch} this stretch is next — same top {targetPct}%
          target.
        </p>
      )}
      {/* Where you finished, what it took, and what it paid -- the four things the season comes down
          to, sized to be read at a glance rather than parsed out of a sentence. */}
      <StatCallouts
        items={[
          {
            label: `Finish · top ${targetPct}% needed`,
            value: `${rank} of ${completedSeason.standings.length}`,
            tone: lastSeasonTargetHit ? 'positive' : 'negative',
          },
          record && { label: 'Record', value: `${record.wins}-${record.losses}` },
          record && {
            label: 'Margin per game',
            value: formatMargin(record),
            tone: record.pointDiff > 0 ? 'positive' : record.pointDiff < 0 ? 'negative' : undefined,
          },
          { label: 'Earned', value: `$${lastBudgetEarned}` },
          { label: 'Budget', value: `$${run.budget}` },
        ]}
      />
      {lastWildcardEvent && (
        <p className={lastWildcardEvent.eventId === 'breakout' ? 'text-positive' : 'text-negative'}>
          {lastWildcardEvent.eventId === 'breakout'
            ? `${lastWildcardEvent.playerName} had a breakout season.`
            : `${lastWildcardEvent.playerName} hit a slump this season.`}
        </p>
      )}
      <TeamSummary team={team} roster={roster} record={record} />
      <h2>Final Standings</h2>
      <StandingsTable rows={completedSeason.standings} teams={teams} userTeamId={run.teamId} />
    </main>
  )
}
