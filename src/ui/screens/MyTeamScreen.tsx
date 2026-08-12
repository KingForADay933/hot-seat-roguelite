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
import { ScreenActions } from '../components/ScreenActions'
import { OnboardingHint } from '../components/OnboardingHint'
import { Section } from '../components/Section'
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

  const heldConsumables = countById(run.consumableInventory)
    .map(({ id, count }) => (count > 1 ? `${CONSUMABLES[id].label} x${count}` : CONSUMABLES[id].label))
    .join(', ')
  const activeConsumables = countById(run.activeConsumablesThisSeason)
    .map(({ id, count }) => (count > 1 ? `${CONSUMABLES[id].label} x${count}` : CONSUMABLES[id].label))
    .join(', ')
  const averageOverall = Math.round(roster.reduce((sum, p) => sum + p.overallRating, 0) / Math.max(roster.length, 1))

  /**
   * Two columns and a lot of folding, because this screen ran 3.9 screens tall and the things you
   * come here to *change* -- minutes, training focus, the rotation chart, the dials -- were the ones
   * you had to scroll past a season summary and a scouting table to reach. The rule throughout is
   * that what you act on is open on the left and what you consult is folded on the right.
   */
  return (
    <main>
      <ScreenActions>
        <button className="primary" onClick={onBack}>
          Back
        </button>
      </ScreenActions>

      <OnboardingHint spot="my-team">
        Minutes and training focus are editable in the roster below, the rotation chart sets who is on the floor period by period, and the Game Plan dials change how your system is played.
      </OnboardingHint>

      <h1>
        {team.city} {team.name}
      </h1>
      <p className="screen-lede">
        Stretch {run.stretchNumber}, Season {run.seasonInStretch} of {run.seasonsPerStretch} · finish top {targetPct}% or
        it&apos;s over · {run.seasonsPlayed} survived · {market.label}, budget ${run.budget}
      </p>

      <div className="screen-columns">
        <div>
          <Section
            title="Roster"
            summary={`${roster.length} players · avg ${averageOverall} OVR`}
            defaultOpen
          >
            <p className="section-note">
              Each attribute shows its current rating; a green <span className="headroom">+N</span> is how much growth is
              left before that player&apos;s fixed potential. Minutes and training focus can be changed here at any time --
              they take effect from the next stretch of games.
            </p>
            <RosterDetailPanel team={team} roster={roster} houseRule={run.houseRule} onSetMinutes={onSetMinutes} onSetFocus={onSetFocus} />
          </Section>

          <Section title="Rotation Chart" summary="who is on the floor, period by period">
            <RotationChartEditor team={team} roster={roster} playersById={playersById} onSetRotationPlan={onSetRotationPlan} />
          </Section>
        </div>

        <div>
          {/* Open, because these are decisions and they are the cheapest ones on the screen to
              change. The descriptions that used to sit between them moved into Team Profile below --
              reading them is a once-a-run thing, changing a dial is not. */}
          <Section title="Game Plan" summary={`${offense.name} · ${defense.name}`} defaultOpen>
            <TacticalFocusControls focus={team.tacticalFocus} onChange={onSetTacticalFocus} side="offense" />
            <p className="section-note">
              <strong>Defense:</strong> <DefensiveSchemeSelect value={team.defensiveStrategyId} onChange={onSetDefensiveScheme} /> --{' '}
              {defense.description}
            </p>
            <TacticalFocusControls focus={team.tacticalFocus} onChange={onSetTacticalFocus} side="defense" />
          </Section>

          <Section title="Team Profile" summary={`${quirk.label} · ${houseRule.label}`}>
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
              <p>
                <strong>{market.label}</strong> -- {market.description}
              </p>
              <p>
                <strong>Head Coach: {team.coaching.headCoachRating}</strong> --{' '}
                {team.practiceSettings.individualDevelopmentShare}% of practice goes to individual development.
              </p>
            </div>
          </Section>

          <Section title="Season Averages" summary={record ? `${record.wins}-${record.losses}` : 'no games yet'}>
            <TeamSummary team={team} roster={roster} record={record} />
          </Section>

          <Section
            title="Coaching Staff"
            summary={run.coachingUpgrades.length > 0 ? `${run.coachingUpgrades.length} bought` : 'none bought'}
          >
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
          </Section>

          <Section
            title="Consumables"
            summary={`${run.consumableInventory.length}/${CONSUMABLE_INVENTORY_CAPACITY} held`}
          >
            <p>Held: {heldConsumables || 'none'}</p>
            <p>Active this season: {activeConsumables || 'none'}</p>
          </Section>

          <Section title="Scouting" summary="consistency, clutch, durability">
            <p className="section-note">Ratings the simulation reads that don&apos;t show up in the attribute sheet.</p>
            <ScoutingPanel team={team} roster={roster} />
          </Section>
        </div>
      </div>
    </main>
  )
}
