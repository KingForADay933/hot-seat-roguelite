import type { RunBundle } from '../../data/persistence/runRepository'
import { OFFENSIVE_PLAYBOOKS } from '../../data/presets'
import { COACHING_UPGRADES } from '../../run/coachingUpgrades'
import { MARKET_SIZES } from '../../run/marketSize'
import { buildRunSummary, type RunSummary, type SeasonRecap } from '../../run/runSummary'
import { HOUSE_RULES } from '../../run/variation/houseRules'
import { ROSTER_QUIRKS } from '../../run/variation/rosterQuirks'

/** Ordinal finish -- "3rd of 8" reads better than a bare rank on a results screen. */
function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

/**
 * The line that actually answers "what got me fired."
 *
 * Deliberately different depending on how the run went, because the honest answer is different. A
 * run that missed by a single win deserves to be told so; one that was never in it shouldn't be
 * softened into a near-miss it wasn't.
 */
function verdict(summary: RunSummary, seasonsPerStretch: number): string {
  const { firedIn, closestMiss, stretchesCleared } = summary
  if (!firedIn) return 'The run ended.'

  const ran = `You finished ${ordinal(firedIn.rank)} needing ${ordinal(firedIn.targetRank)} or better`
  const chances = `, on the last of ${seasonsPerStretch} season${seasonsPerStretch === 1 ? '' : 's'} the job gave you`

  // A run that cleared ground first is a different story from one that never got going -- the bar
  // it died against was one it had already raised itself.
  const context =
    stretchesCleared > 0
      ? ` You'd already cleared ${stretchesCleared} stretch${stretchesCleared === 1 ? '' : 'es'}, which is what made the bar that high.`
      : ''

  if (closestMiss && closestMiss.winsShort > 0 && closestMiss.winsShort <= 2) {
    const which = closestMiss.seasonNumber === firedIn.seasonNumber ? 'That season' : `Season ${closestMiss.seasonNumber}`
    return `${ran}${chances}. ${which} came up ${closestMiss.winsShort} win${closestMiss.winsShort === 1 ? '' : 's'} short.${context}`
  }

  if (firedIn.winsShort > 6) {
    return `${ran}${chances} — ${firedIn.winsShort} wins off the pace, and not especially close.${context}`
  }

  return `${ran}${chances}, ${firedIn.winsShort} win${firedIn.winsShort === 1 ? '' : 's'} short of the cutoff.${context}`
}

function SeasonRow({ season }: { season: SeasonRecap }) {
  return (
    <tr>
      <td className="numeric">{season.seasonNumber}</td>
      <td className="numeric">{season.stretchNumber}</td>
      {/* The resolved rank, not the fraction it came from: "top 10%" of an 8-team league means
          1st, and making the reader do that conversion buries the whole point of the column. */}
      <td className="numeric" title={`top ${Math.round(season.targetRankFraction * 100)}%`}>
        {ordinal(season.targetRank)}
      </td>
      <td className="numeric">{ordinal(season.rank)}</td>
      <td className="numeric">
        {season.wins}-{season.losses}
      </td>
      <td className="numeric">{signed(Math.round(season.pointDiff))}</td>
      <td className={season.hitTarget ? 'text-positive' : 'text-negative'}>
        {season.hitTarget ? 'Cleared' : season.winsShort > 0 ? `Missed by ${season.winsShort}` : 'Missed'}
      </td>
    </tr>
  )
}

/**
 * The run's epilogue (Tier 8) -- what the design doc calls the emotional payoff, and what used to be
 * three lines of "you survived N seasons."
 *
 * Everything here comes from `League.seasonHistory`, the one thing retained across rollovers. See
 * run/runSummary.ts for why that's the source rather than Coaching Insights.
 */
export function FiredScreen({ bundle, onNewRun }: { bundle: RunBundle; onNewRun: () => void }) {
  const { run, league, teams } = bundle
  const team = teams.find((t) => t.id === run.teamId)
  const summary = buildRunSummary(run, league)

  const quirk = ROSTER_QUIRKS[run.rosterQuirk]
  const houseRule = HOUSE_RULES[run.houseRule]
  const market = MARKET_SIZES[run.marketSize]
  const system = team ? OFFENSIVE_PLAYBOOKS[team.offensiveStrategyId] : undefined

  return (
    <main>
      <h1>Fired</h1>
      <p>
        {team ? `The ${team.city} ${team.name} let you go after ` : 'Let go after '}
        {run.seasonsPlayed} season{run.seasonsPlayed === 1 ? '' : 's'}.
      </p>

      <div className="team-summary">
        <p>{verdict(summary, run.seasonsPerStretch)}</p>
      </div>

      <h2>The Run</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="numeric">Season</th>
              <th className="numeric">Stretch</th>
              <th className="numeric">Needed</th>
              {/* Finish sits next to Needed on purpose -- the two together are the whole story. */}
              <th className="numeric">Finish</th>
              <th className="numeric">Record</th>
              <th className="numeric">Diff</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {summary.seasons.map((season) => (
              <SeasonRow key={season.seasonNumber} season={season} />
            ))}
          </tbody>
        </table>
      </div>

      <p>
        {summary.stretchesCleared} stretch{summary.stretchesCleared === 1 ? '' : 'es'} cleared ·{' '}
        {summary.totalWins}-{summary.totalLosses} overall
        {summary.bestSeason && ` · best finish ${ordinal(summary.bestSeason.rank)} in season ${summary.bestSeason.seasonNumber}`}
        {' · '}${run.budget} left unspent
      </p>

      <h2>What You Built</h2>
      <div className="team-summary">
        <p>
          <strong>{market.label}</strong> — {market.description}
        </p>
        <p>
          <strong>{quirk.label}</strong> — {quirk.description}
        </p>
        <p>
          <strong>House Rule: {houseRule.label}</strong> — {houseRule.description}
        </p>
        {system && team && (
          <p>
            <strong>{system.name}</strong> — {system.description} (Synergy: {team.synergyScore})
          </p>
        )}
        <p>
          <strong>Coaching Staff:</strong>{' '}
          {run.coachingUpgrades.length > 0
            ? run.coachingUpgrades.map((id) => COACHING_UPGRADES[id].label).join(', ')
            : 'nothing bought all run'}
        </p>
      </div>

      <button className="primary" onClick={onNewRun}>
        Start New Run
      </button>
    </main>
  )
}
