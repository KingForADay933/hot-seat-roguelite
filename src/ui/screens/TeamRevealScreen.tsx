import type { RunBundle } from '../../data/persistence/runRepository'
import { MARKET_SIZES } from '../../run/marketSize'
import { HOUSE_RULES } from '../../run/variation/houseRules'
import { ROSTER_QUIRKS } from '../../run/variation/rosterQuirks'
import { TeamSummary } from '../components/TeamSummary'

export function TeamRevealScreen({ bundle, onBeginSeason }: { bundle: RunBundle; onBeginSeason: () => void }) {
  const { run, teams, players } = bundle
  const team = teams.find((t) => t.id === run.teamId)
  if (!team) return null

  const roster = players.filter((p) => p.teamId === team.id)
  const targetPct = Math.round(run.target.rankFraction * 100)
  const quirk = ROSTER_QUIRKS[run.rosterQuirk]
  const houseRule = HOUSE_RULES[run.houseRule]
  const market = MARKET_SIZES[run.marketSize]

  return (
    <main>
      <h1>
        {team.city} {team.name}
      </h1>
      <p>
        Stretch {run.stretchNumber}, Season {run.seasonInStretch} of {run.seasonsPerStretch}. Finish top {targetPct}% of
        standings or it&apos;s over.
      </p>
      <p>
        {market.label} -- Budget: ${run.budget}
      </p>
      <div className="team-summary">
        <p>
          <strong>{quirk.label}</strong> -- {quirk.description}
        </p>
        <p>
          <strong>House Rule: {houseRule.label}</strong> -- {houseRule.description}
        </p>
      </div>
      <TeamSummary team={team} roster={roster} />
      <button className="primary" onClick={onBeginSeason}>
        Begin Season
      </button>
    </main>
  )
}
