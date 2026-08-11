import { DEFENSIVE_SCHEMES, type DefensiveSchemeId } from '../../data/presets'
import type { AttributeKey, TacticalFocus } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { computeStandings } from '../../engine/schedule/standings'
import { summarizeChunkInsights } from '../../run/chunkInsightSummary'
import { SEASON_CHUNK_COUNT } from '../../run/constants'
import { DefensiveSchemeSelect } from '../components/DefensiveSchemeSelect'
import { TacticalFocusControls } from '../components/TacticalFocusControls'
import { RosterAdjustmentPanel } from '../components/RosterAdjustmentPanel'
import { Section } from '../components/Section'
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

  // What the collapsed standings still tells you: where you sit, and whether that is safe. The rank
  // is what the run is judged on, so it is the one figure worth surfacing without opening the table.
  const rank = standings.findIndex((row) => row.teamId === run.teamId) + 1
  const own = standings.find((row) => row.teamId === run.teamId)
  const standingsSummary = own ? `${rank} of ${standings.length} · ${own.wins}-${own.losses}` : `${standings.length} teams`

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

      {/* Insights stay open and sit *beside* the adjustment rather than above it. The complaint and
          the fix belonging together is the whole design of this screen -- folding the complaint away
          would have made it fit by defeating its purpose. Only the standings, which are reference,
          start collapsed. */}
      <div className="screen-columns">
        <div>
          <Section title="Minutes &amp; Training" summary={`${roster.length} players`} defaultOpen>
            <p className="section-note">Respond to what the Insights are telling you before the next stretch plays out.</p>
            <RosterAdjustmentPanel team={team} roster={roster} houseRule={run.houseRule} onSetMinutes={onSetMinutes} onSetFocus={onSetFocus} />
          </Section>
        </div>

        <div>
          <Section
            title="Coaching Insights"
            summary={insights.length > 0 ? `${insights.length} to answer` : 'nothing notable'}
            defaultOpen
          >
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
          </Section>

          {/* Directly under the Insights, which is what the two of them are for: "your scheme keeps
              getting picked on" is the most common thing this screen has to say, and the control that
              answers it should be the next thing your eye lands on. They used to be stacked a full
              screen apart. */}
          <Section title="Scheme &amp; Dials" summary={DEFENSIVE_SCHEMES[team.defensiveStrategyId]?.name} defaultOpen>
            <p className="position-minutes">
              <strong>Defense:</strong> <DefensiveSchemeSelect value={team.defensiveStrategyId} onChange={onSetDefensiveScheme} />{' '}
              {DEFENSIVE_SCHEMES[team.defensiveStrategyId]?.description}
            </p>
            <TacticalFocusControls focus={team.tacticalFocus} onChange={onSetTacticalFocus} side="offense" />
            <TacticalFocusControls focus={team.tacticalFocus} onChange={onSetTacticalFocus} side="defense" />
          </Section>

          <Section title="Standings So Far" summary={standingsSummary}>
            <StandingsTable rows={standings} teams={teams} userTeamId={run.teamId} />
          </Section>
        </div>
      </div>

      <div className="stretch-actions">
        <button className="primary" onClick={onContinue}>
          Continue Season
        </button>
        <button onClick={onSimStretch}>Sim Next Stretch</button>
      </div>
    </main>
  )
}
