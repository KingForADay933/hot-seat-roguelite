import type { AttributeKey, RotationPlan, TacticalFocus } from '../../data/types'
import { DEFENSIVE_SCHEMES, OFFENSIVE_PLAYBOOKS, type DefensiveSchemeId } from '../../data/presets'
import { DefensiveSchemeSelect } from '../components/DefensiveSchemeSelect'
import { TacticalFocusControls } from '../components/TacticalFocusControls'
import type { RunBundle } from '../../data/persistence/runRepository'
import { computeStandings } from '../../engine/schedule/standings'
import { COACHING_UPGRADES } from '../../run/coachingUpgrades'
import { CONSUMABLES } from '../../run/consumables'
import { CONSUMABLE_INVENTORY_CAPACITY } from '../../run/constants'
import { MARKET_SIZES } from '../../run/marketSize'
import { HOUSE_RULES } from '../../run/variation/houseRules'
import { ROSTER_QUIRKS } from '../../run/variation/rosterQuirks'
import { RosterDetailPanel } from '../components/RosterDetailPanel'
import { RotationChartEditor } from '../components/RotationChartEditor'
import { ScoutingPanel } from '../components/ScoutingPanel'
import { TeamSummary } from '../components/TeamSummary'

/** Counts repeats so a stash of two Lucky Jerseys reads "Lucky Jersey x2" rather than twice over. */
function countById<T extends string>(ids: T[]): { id: T; count: number }[] {
  const counts = new Map<T, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()].map(([id, count]) => ({ id, count }))
}

/**
 * The GM's reference sheet: everything the run has handed them (roster, ratings, growth headroom,
 * intangibles, system, modifiers, owned upgrades and held consumables) in one place, reachable from
 * every screen of a live run since all of it feeds shop and rotation decisions. Rotation minutes
 * and training focus are editable here too -- the checkpoint screen's RosterAdjustmentPanel is now
 * a prompt to reconsider them, not the only place they can be set.
 */
export function MyTeamScreen({
  bundle,
  onSetMinutes,
  onSetFocus,
  onSetRotationPlan,
  onSetDefensiveScheme,
  onSetTacticalFocus,
  onBack,
}: {
  bundle: RunBundle
  onSetMinutes: (playerId: string, minutes: number) => void
  onSetFocus: (playerId: string, attribute: AttributeKey | null) => void
  onSetRotationPlan: (plan: RotationPlan) => void
  onSetDefensiveScheme: (schemeId: DefensiveSchemeId) => void
  onSetTacticalFocus: (focus: Partial<TacticalFocus>) => void
  onBack: () => void
}) {
  const { run, teams, players, games } = bundle
  const team = teams.find((t) => t.id === run.teamId)
  if (!team) return null

  const roster = players.filter((p) => p.teamId === team.id)
  const playersById = new Map(players.map((p) => [p.id, p]))
  const record = computeStandings(teams, games).find((row) => row.teamId === team.id)
  const targetPct = Math.round(run.target.rankFraction * 100)
  const quirk = ROSTER_QUIRKS[run.rosterQuirk]
  const houseRule = HOUSE_RULES[run.houseRule]
  const market = MARKET_SIZES[run.marketSize]
  const offense = OFFENSIVE_PLAYBOOKS[team.offensiveStrategyId]
  const defense = DEFENSIVE_SCHEMES[team.defensiveStrategyId]

  return (
    <main>
      <h1>
        {team.city} {team.name}
      </h1>
      <p>
        Stretch {run.stretchNumber}, Season {run.seasonInStretch} of {run.seasonsPerStretch}. Finish top {targetPct}% of
        standings or it&apos;s over. {run.seasonsPlayed} season{run.seasonsPlayed === 1 ? '' : 's'} survived so far.
      </p>
      <p>
        {market.label} -- {market.description} Budget: ${run.budget}
      </p>

      <div className="team-summary">
        <p>
          <strong>{quirk.label}</strong> -- {quirk.description}
        </p>
        <p>
          <strong>House Rule: {houseRule.label}</strong> -- {houseRule.description}
        </p>
        <p>
          <strong>Offense: {offense.name}</strong> -- {offense.description} (Synergy: {team.synergyScore})
        </p>
        {/* Grouped under the system rather than in a block of their own: the system is who the team
            is and these are how it plays, and reading them apart invites the question of whether
            changing a dial changed the offense. It doesn't -- the system is drafted once. */}
        <TacticalFocusControls focus={team.tacticalFocus} onChange={onSetTacticalFocus} side="offense" />
        <p>
          <strong>Defense:</strong> <DefensiveSchemeSelect value={team.defensiveStrategyId} onChange={onSetDefensiveScheme} /> --{' '}
          {defense.description}
        </p>
        <TacticalFocusControls focus={team.tacticalFocus} onChange={onSetTacticalFocus} side="defense" />
        <p>
          <strong>Head Coach: {team.coaching.headCoachRating}</strong> -- {team.practiceSettings.individualDevelopmentShare}% of
          practice goes to individual development.
        </p>
      </div>

      <h2>Season Averages</h2>
      <TeamSummary team={team} roster={roster} record={record} />

      <h2>Coaching Staff</h2>
      {run.coachingUpgrades.length > 0 ? (
        <ul>
          {run.coachingUpgrades.map((id) => (
            <li key={id}>
              <strong>{COACHING_UPGRADES[id].label}</strong> -- {COACHING_UPGRADES[id].description}
            </li>
          ))}
        </ul>
      ) : (
        <p>No coaching upgrades bought yet.</p>
      )}

      <h2>Consumables</h2>
      <p>
        Held ({run.consumableInventory.length}/{CONSUMABLE_INVENTORY_CAPACITY}):{' '}
        {run.consumableInventory.length > 0
          ? countById(run.consumableInventory)
              .map(({ id, count }) => (count > 1 ? `${CONSUMABLES[id].label} x${count}` : CONSUMABLES[id].label))
              .join(', ')
          : 'none'}
      </p>
      <p>
        Active this season:{' '}
        {run.activeConsumablesThisSeason.length > 0
          ? countById(run.activeConsumablesThisSeason)
              .map(({ id, count }) => (count > 1 ? `${CONSUMABLES[id].label} x${count}` : CONSUMABLES[id].label))
              .join(', ')
          : 'none'}
      </p>

      <h2>Roster</h2>
      <p>
        Each attribute shows its current rating; a green <span className="headroom">+N</span> is how much growth is left
        before that player&apos;s fixed potential. Minutes and training focus can be changed here at any time -- they
        take effect from the next stretch of games.
      </p>
      <RosterDetailPanel team={team} roster={roster} houseRule={run.houseRule} onSetMinutes={onSetMinutes} onSetFocus={onSetFocus} />

      <h2>Rotation Chart</h2>
      <RotationChartEditor team={team} roster={roster} playersById={playersById} onSetRotationPlan={onSetRotationPlan} />

      <h2>Scouting</h2>
      <p>Ratings the simulation reads that don&apos;t show up in the attribute sheet.</p>
      <ScoutingPanel team={team} roster={roster} />

      <button className="primary" onClick={onBack}>
        Back
      </button>
    </main>
  )
}
