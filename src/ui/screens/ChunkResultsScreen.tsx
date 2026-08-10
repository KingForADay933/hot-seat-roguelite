import { DEFENSIVE_SCHEMES, type DefensiveSchemeId } from '../../data/presets'
import type { AttributeKey, TacticalFocus } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { computeStandings } from '../../engine/schedule/standings'
import { summarizeChunkInsights } from '../../run/chunkInsightSummary'
import { SEASON_CHUNK_COUNT } from '../../run/constants'
import { DefensiveSchemeSelect } from '../components/DefensiveSchemeSelect'
import { TacticalFocusControls } from '../components/TacticalFocusControls'
import { RosterAdjustmentPanel } from '../components/RosterAdjustmentPanel'
import { StandingsTable } from '../components/StandingsTable'

export function ChunkResultsScreen({
  bundle,
  onContinue,
  onSimStretch,
  onSetMinutes,
  onSetFocus,
  onSetDefensiveScheme,
  onSetTacticalFocus,
}: {
  bundle: RunBundle
  onContinue: () => void
  onSimStretch: () => void
  onSetMinutes: (playerId: string, minutes: number) => void
  onSetFocus: (playerId: string, attribute: AttributeKey | null) => void
  onSetDefensiveScheme: (schemeId: DefensiveSchemeId) => void
  onSetTacticalFocus: (focus: Partial<TacticalFocus>) => void
}) {
  const { run, teams, players, games, lastWildcardEvent, lastChunkInsights } = bundle
  const team = teams.find((t) => t.id === run.teamId)
  if (!team) return null

  const roster = players.filter((p) => p.teamId === team.id)
  const standings = computeStandings(teams, games)
  // finalizeChunk already collapsed these on the way in. Applied again here (the operation is
  // idempotent) so a run saved before it did still reads as one line per problem rather than one
  // per game -- there are live saves on itch, and the checkpoint is the screen they sit on most.
  const insights = summarizeChunkInsights(lastChunkInsights, DEFENSIVE_SCHEMES[team.defensiveStrategyId]?.name)

  return (
    <main>
      <h1>
        Checkpoint {run.chunkInSeason} of {SEASON_CHUNK_COUNT - 1}
      </h1>
      <p>
        {team.city} {team.name} -- Stretch {run.stretchNumber}, Season {run.seasonInStretch} of {run.seasonsPerStretch}.
      </p>

      {lastWildcardEvent && (
        <p className={lastWildcardEvent.eventId === 'breakout' ? 'text-positive' : 'text-negative'}>
          {lastWildcardEvent.eventId === 'breakout'
            ? `${lastWildcardEvent.playerName} had a breakout to start the season.`
            : `${lastWildcardEvent.playerName} started the season in a slump.`}
        </p>
      )}

      <h2>Coaching Insights</h2>
      {insights.length > 0 ? (
        <ul>
          {insights.map((insight, i) => (
            // Toned so good news reads as good news. Only performance trends carry a tone; the
            // possession-log kinds are problems by construction and stay unstyled.
            <li
              key={i}
              className={insight.tone === 'positive' ? 'text-positive' : insight.tone === 'negative' ? 'text-negative' : undefined}
            >
              {insight.text}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing notable this stretch.</p>
      )}

      <h2>Standings So Far</h2>
      <StandingsTable rows={standings} teams={teams} userTeamId={run.teamId} />

      <h2>Adjust the Rotation</h2>
      <p>Respond to what the Insights above are telling you before the next stretch of games plays out.</p>
      {/* Next to the Insights on purpose: "your scheme keeps getting picked on" is the most common
          thing this screen has to say, and the fix for it belongs where the complaint is. */}
      <p className="position-minutes">
        <strong>Defense:</strong> <DefensiveSchemeSelect value={team.defensiveStrategyId} onChange={onSetDefensiveScheme} />{' '}
        {DEFENSIVE_SCHEMES[team.defensiveStrategyId]?.description}
      </p>
      {/* Same argument as the scheme select above: the checkpoint is where a GM reads what went
          wrong, so it is where the dials that answer it belong. */}
      <div className="team-summary">
        <TacticalFocusControls focus={team.tacticalFocus} onChange={onSetTacticalFocus} side="offense" />
        <TacticalFocusControls focus={team.tacticalFocus} onChange={onSetTacticalFocus} side="defense" />
      </div>
      <RosterAdjustmentPanel team={team} roster={roster} houseRule={run.houseRule} onSetMinutes={onSetMinutes} onSetFocus={onSetFocus} />

      <div className="stretch-actions">
        <button className="primary" onClick={onContinue}>
          Continue Season
        </button>
        <button onClick={onSimStretch}>Sim Next Stretch</button>
      </div>
    </main>
  )
}
