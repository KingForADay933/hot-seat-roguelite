import { DEFENSIVE_SCHEMES } from '../../data/presets'
import type { RunBundle } from '../../data/persistence/runRepository'
import type { CoachingInsight } from '../../engine/insights/generateCoachingInsights'
import { summarizeChunkInsights } from '../../run/chunkInsightSummary'
import { SEASON_CHUNK_COUNT } from '../../run/constants'
import { comparePerformance, describePerformance, type PerformanceComparison } from '../../run/performanceInsights'
import { describeRunInsight, insightsBySeason } from '../../run/runInsights'
import { runTeamChunkGames } from '../../run/seasonChunks'
import { ScreenActions } from '../components/ScreenActions'
import { OnboardingHint } from '../components/OnboardingHint'
import { StatCallouts } from '../components/StatCallouts'

/** True once every game on the schedule has been played -- the run is sitting on season results or
 *  in the shop, and `run.chunkInSeason` has already been reset for a season that hasn't begun. */
function seasonIsComplete(bundle: RunBundle): boolean {
  return bundle.games.length > 0 && bundle.games.every((game) => game.isPlayed)
}

/**
 * Which chunk this screen is reporting on.
 *
 * `run.chunkInSeason` means three different things depending on where the run is, and reading it
 * without that distinction is wrong in two of them:
 *
 * - While a stretch is open it is the chunk being played.
 * - Once a chunk closes finalizeChunk has already incremented it, so the chunk just played is the
 *   one before -- otherwise every checkpoint, which is exactly when a GM opens this, shows an empty
 *   stretch that hasn't started.
 * - Once the *season* closes evaluateSeasonEnd resets it to 0 while `games` still holds the finished
 *   season, so a naive read reported stretch 1 of a season that was already over.
 */
function reportingChunk(bundle: RunBundle): number {
  if (bundle.stretchInProgress) return bundle.run.chunkInSeason
  if (bundle.run.chunkInSeason > 0) return bundle.run.chunkInSeason - 1
  return seasonIsComplete(bundle) ? SEASON_CHUNK_COUNT - 1 : 0
}

/**
 * The season `bundle.games` actually belongs to, which is not always `league.seasonNumber`.
 *
 * evaluateSeasonEnd rolls the league forward the moment the last chunk lands, but the schedule it
 * just finished stays in the bundle until the next season is generated. Without this the season log
 * looked up a season that had no records yet and reported nothing at the one moment a GM is most
 * likely to be reviewing the year.
 */
function seasonOfGames(bundle: RunBundle): number {
  return seasonIsComplete(bundle) ? Math.max(bundle.league.seasonNumber - 1, 1) : bundle.league.seasonNumber
}

function ComparisonList({ comparisons }: { comparisons: PerformanceComparison[] }) {
  return (
    <ul>
      {comparisons.map((comparison) => (
        <li key={comparison.metricId} className={comparison.improvement > 0 ? 'text-positive' : 'text-negative'}>
          {describePerformance(comparison)}
        </li>
      ))}
    </ul>
  )
}

/**
 * Everything the game has noticed about how this team is playing, in one place.
 *
 * Two different kinds of observation live here and they are deliberately not mixed. **Rates** --
 * shooting, ball security, what the defence gives up -- are recomputed from box scores every time
 * this screen renders, so they move as soon as a game resolves rather than waiting for the
 * checkpoint. **Events** -- a defender hunted, a player pulled -- come from possession logs, which
 * are stripped as each game resolves, so they arrive already captured in the bundle.
 *
 * The split by tone is the point of the screen. Until now the game only ever told a GM what had gone
 * wrong, which made the insights read as nagging and gave no way to tell a plan that was working
 * from one that merely hadn't broken yet.
 */
export function InsightsScreen({ bundle, onBack }: { bundle: RunBundle; onBack: () => void }) {
  const { run, teams, games, stretchInProgress, pendingChunkInsights, lastChunkInsights, runInsights } = bundle
  const team = teams.find((t) => t.id === run.teamId)
  if (!team) return null

  const chunk = reportingChunk(bundle)
  const seasonNumber = seasonOfGames(bundle)
  const complete = seasonIsComplete(bundle)
  const chunkGames = runTeamChunkGames(games, chunk, run.teamId)
  const playedInChunk = chunkGames.filter((g) => g.isPlayed)
  const chunkGameIds = new Set(chunkGames.map((g) => g.id))

  const playedThisSeason = games.filter((g) => g.isPlayed)
  const earlierThisSeason = playedThisSeason.filter((g) => !chunkGameIds.has(g.id))

  // Recomputed live rather than read from the bundle, which is what makes this update per game
  // instead of per checkpoint. finalizeChunk runs the identical comparison when the chunk closes;
  // this is the same function, not a parallel one that could disagree with it.
  const comparisons = comparePerformance(playedInChunk, earlierThisSeason, playedThisSeason, run.teamId)
  const goingWell = comparisons.filter((c) => c.improvement > 0)
  const needsWork = comparisons.filter((c) => c.improvement <= 0)

  // While a stretch is open the events are still accumulating; once it closes the collapsed set the
  // checkpoint shows is the honest record of it.
  const rawEvents: CoachingInsight[] = stretchInProgress ? pendingChunkInsights : lastChunkInsights
  const events = summarizeChunkInsights(
    // Trends are stored alongside events once a chunk closes (finalizeChunk writes both, so the
    // checkpoint and the run history get them), but this screen recomputes them live above. Without
    // this filter a closed chunk showed each trend twice -- once toned and sorted, once as a bare
    // line in the "needs work" list regardless of whether it was good news.
    rawEvents.filter((insight) => insight.kind !== 'performance-trend'),
    DEFENSIVE_SCHEMES[team.defensiveStrategyId]?.name,
  )

  const thisSeasonRecords = insightsBySeason(runInsights).find((s) => s.seasonNumber === seasonNumber)?.records ?? []

  return (
    <main>
      <ScreenActions>
        <button className="primary" onClick={onBack}>
          Back
        </button>
      </ScreenActions>

      <OnboardingHint spot="insights">
        Rates here update after every game, split into what is going better than your usual and what is going worse. This is where a scheme that keeps getting picked on shows up first.
      </OnboardingHint>

      <h1>Coaching Insights</h1>
      <p>
        {team.city} {team.name} -- {complete ? `Season ${seasonNumber} complete; reviewing its final stretch` : `Stretch ${chunk + 1} of ${SEASON_CHUNK_COUNT}`}
        . Rates update after every game; the season log below is written when each stretch closes.
      </p>

      {/* The shape of the stretch before any of the prose: how far through it you are, and how the
          two lists below split. */}
      <StatCallouts
        items={[
          { label: 'Games played', value: `${playedInChunk.length} of ${chunkGames.length}` },
          { label: "What's working", value: goingWell.length, tone: goingWell.length > 0 ? 'positive' : undefined },
          {
            label: 'Needs work',
            value: needsWork.length + events.length,
            tone: needsWork.length + events.length > 0 ? 'negative' : undefined,
          },
        ]}
      />

      {playedInChunk.length === 0 ? (
        <p>No games played in this stretch yet.</p>
      ) : (
        <>
          <h2>What&apos;s Working</h2>
          {goingWell.length > 0 ? (
            <ComparisonList comparisons={goingWell} />
          ) : (
            <p className="section-note">Nothing has moved far enough above your usual to call it out yet.</p>
          )}

          <h2>What Needs Work</h2>
          {needsWork.length > 0 || events.length > 0 ? (
            <>
              {needsWork.length > 0 && <ComparisonList comparisons={needsWork} />}
              {events.length > 0 && (
                <ul>
                  {events.map((insight, i) => (
                    <li key={i}>{insight.text}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="section-note">Nothing is going badly enough to flag.</p>
          )}
        </>
      )}

      <h2>Season {seasonNumber}{complete ? ' — Final' : ' So Far'}</h2>
      <p className="section-note">
        What has recurred across this season&apos;s stretches, rather than what happened in any one of them. This is the record that
        survives to the end of the run.
      </p>
      {thisSeasonRecords.length > 0 ? (
        <ul>
          {thisSeasonRecords.map((record) => (
            <li
              key={`${record.kind}-${record.subjectId}-${record.tone ?? ''}`}
              className={record.tone === 'positive' ? 'text-positive' : record.tone === 'negative' ? 'text-negative' : undefined}
            >
              {describeRunInsight({
                kind: record.kind,
                subjectId: record.subjectId,
                subjectName: record.subjectName,
                tone: record.tone,
                totalOccurrences: record.occurrences,
                seasons: [record.seasonNumber],
              })}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing has recurred often enough to be a season-level pattern yet.</p>
      )}

    </main>
  )
}
