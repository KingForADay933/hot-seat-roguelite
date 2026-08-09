import { useState } from 'react'
import { OFFENSIVE_PLAYBOOKS, type SystemId } from '../../data/presets'
import type { Player, Team } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { SYNERGY_NEUTRAL } from '../../engine/constants'
import { POSITION_ORDER } from '../../engine/matchup'
import { average } from '../../engine/math'
import { MARKET_SIZES, type MarketSizeId } from '../../run/marketSize'
import { targetForStretch } from '../../run/target'
import { HOUSE_RULES, type HouseRuleId } from '../../run/variation/houseRules'
import { ROSTER_QUIRKS, type RosterQuirkId } from '../../run/variation/rosterQuirks'
import {
  computeInitialSynergyScore,
  computePlayerSystemAffinity,
  computeProjectedUsageShares,
  computeSystemFitBreakdown,
} from '../../run/variation/systemDraft'
import { PlayerRevealCard, type SystemFitEntry } from '../components/PlayerRevealCard'
import { SystemChoiceCard } from '../components/SystemChoiceCard'
import { TeamSummary } from '../components/TeamSummary'
import type { PendingReveal } from '../state/runContext.core'

export type TeamRevealScreenProps =
  /** Setup phase two: roster final, system still open. Nothing is persisted yet. */
  | { mode: 'draft-system'; reveal: PendingReveal; onLockSystem: (system: SystemId) => void }
  /** The same readout after the system is locked and the run is saved -- the pre-tipoff briefing.
   *  Both stretch entry points live here: watch the games one at a time, or sim the whole stretch. */
  | { mode: 'locked'; bundle: RunBundle; onBeginSeason: () => void; onSimSeason: () => void }

/** The fields both modes need, pulled from whichever source is in play. In draft-system mode the
 *  run doesn't exist yet, so the stakes are derived the same way createRun would derive them. */
interface RevealView {
  team: Team
  roster: Player[]
  rosterQuirk: RosterQuirkId
  houseRule: HouseRuleId
  marketSize: MarketSizeId
  stretchNumber: number
  seasonInStretch: number
  seasonsPerStretch: number
  rankFraction: number
  budget: number
}

function toView(props: TeamRevealScreenProps): RevealView | null {
  if (props.mode === 'locked') {
    const { run, teams, players } = props.bundle
    const team = teams.find((t) => t.id === run.teamId)
    if (!team) return null
    return {
      team,
      roster: players.filter((p) => p.teamId === team.id),
      rosterQuirk: run.rosterQuirk,
      houseRule: run.houseRule,
      marketSize: run.marketSize,
      stretchNumber: run.stretchNumber,
      seasonInStretch: run.seasonInStretch,
      seasonsPerStretch: run.seasonsPerStretch,
      rankFraction: run.target.rankFraction,
      budget: run.budget,
    }
  }

  const { teams, players, teamId, rosterQuirk, houseRule, marketSize } = props.reveal
  const team = teams.find((t) => t.id === teamId)
  if (!team) return null
  return {
    team,
    roster: players.filter((p) => p.teamId === teamId),
    rosterQuirk,
    houseRule,
    marketSize,
    stretchNumber: 1,
    seasonInStretch: 1,
    seasonsPerStretch: MARKET_SIZES[marketSize].seasonsPerStretch,
    rankFraction: targetForStretch(1).rankFraction,
    budget: 0,
  }
}

/** How many rostered players list each position first -- the depth chart at a glance, and the
 *  fastest way to see what Stacked at Guard or Short Bench actually did to the roster. */
function positionalDepth(roster: Player[]): { position: string; count: number; bestOverall: number }[] {
  return POSITION_ORDER.map((position) => {
    const atPosition = roster.filter((p) => p.positions[0] === position)
    return {
      position,
      count: atPosition.length,
      bestOverall: atPosition.length === 0 ? 0 : Math.max(...atPosition.map((p) => p.overallRating)),
    }
  })
}

export function TeamRevealScreen(props: TeamRevealScreenProps) {
  const [pick, setPick] = useState<SystemId | null>(null)
  const view = toView(props)
  if (!view) return null

  const { team, roster } = view
  const quirk = ROSTER_QUIRKS[view.rosterQuirk]
  const houseRule = HOUSE_RULES[view.houseRule]
  const market = MARKET_SIZES[view.marketSize]
  const targetPct = Math.round(view.rankFraction * 100)
  const depth = positionalDepth(roster)
  const starterIds = new Set(team.startingFive)

  // Draft mode scores every candidate against this roster so the cards can be compared directly;
  // locked mode scores only the system already in place, which keeps the per-player fit column
  // meaningful ("who actually suits what we're running") instead of dropping it entirely.
  const candidateSystems: SystemId[] = props.mode === 'draft-system' ? props.reveal.systemOptions : [team.offensiveStrategyId as SystemId]
  const scoredSystems = candidateSystems.map((id) => ({
    id,
    playbook: OFFENSIVE_PLAYBOOKS[id],
    // In locked mode the team's stored synergyScore is authoritative -- camps and coaching
    // upgrades push it above the raw roster-fit number, so recomputing would understate it.
    synergy: props.mode === 'locked' ? team.synergyScore : computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS[id], roster, team),
    breakdown: computeSystemFitBreakdown(OFFENSIVE_PLAYBOOKS[id], roster, team),
  }))

  // Locked mode has to name the team's system explicitly rather than lean on `pick`: React reuses
  // this component instance across the lock, so the leftover pick happens to be right immediately
  // after locking in but is null on any later visit (a reload, or coming back pre-tipoff).
  const highlightedSystemId = props.mode === 'locked' ? team.offensiveStrategyId : pick

  // Touch projections only for the highlighted system -- computing them for every candidate would
  // be four passes over the roster to display three numbers nobody asked for.
  const usageShares = highlightedSystemId
    ? computeProjectedUsageShares(OFFENSIVE_PLAYBOOKS[highlightedSystemId], roster, team)
    : null

  const systemFitsFor = (player: Player): SystemFitEntry[] =>
    scoredSystems.map((s) => ({
      systemId: s.id,
      name: s.playbook.name,
      affinity: computePlayerSystemAffinity(s.playbook, player),
      usageShare: s.id === highlightedSystemId ? (usageShares?.get(player.id) ?? null) : null,
    }))

  const orderedRoster = [...roster].sort((a, b) => {
    const starterDelta = Number(starterIds.has(b.id)) - Number(starterIds.has(a.id))
    if (starterDelta !== 0) return starterDelta
    if (starterIds.has(a.id)) return POSITION_ORDER.indexOf(a.positions[0]) - POSITION_ORDER.indexOf(b.positions[0])
    return b.overallRating - a.overallRating
  })
  const starters = orderedRoster.filter((p) => starterIds.has(p.id))
  const bench = orderedRoster.filter((p) => !starterIds.has(p.id))

  return (
    <main>
      <h1>
        {team.city} {team.name}
      </h1>
      <p>
        Stretch {view.stretchNumber}, Season {view.seasonInStretch} of {view.seasonsPerStretch}. Finish top {targetPct}% of standings or
        it&apos;s over.
      </p>

      <div className="team-summary">
        <p>
          <strong>{market.label}</strong> -- {market.description} Budget: ${view.budget}.
        </p>
        <p>
          <strong>{quirk.label}</strong> -- {quirk.description}
        </p>
        <p>
          <strong>House Rule: {houseRule.label}</strong> -- {houseRule.description}
        </p>
        {props.mode === 'locked' && (
          <p>
            <strong>System: {OFFENSIVE_PLAYBOOKS[team.offensiveStrategyId].name}</strong> -- {OFFENSIVE_PLAYBOOKS[team.offensiveStrategyId].description}{' '}
            (Synergy {team.synergyScore}, neutral is {SYNERGY_NEUTRAL})
          </p>
        )}
      </div>

      <h2>Roster Shape</h2>
      <div className="team-summary">
        <p>
          {roster.length} players &middot; average age {average(roster.map((p) => p.age)).toFixed(1)} &middot; average OVR{' '}
          {Math.round(average(roster.map((p) => p.overallRating)))}
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Depth</th>
                {depth.map((d) => (
                  <th key={d.position} className="numeric">
                    {d.position}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Players</td>
                {depth.map((d) => (
                  <td key={d.position} className={`numeric${d.count === 0 ? ' text-negative' : ''}`}>
                    {d.count}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Best OVR</td>
                {depth.map((d) => (
                  <td key={d.position} className="numeric">
                    {d.count === 0 ? '--' : d.bestOverall}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <TeamSummary team={team} roster={roster} />

      <h2>Scouting Report</h2>
      <p className="section-note">
        Hover a trait tag for what it does. Growth room is the total attribute points each player still has below his potential. System fit is
        signed and relative to each player&apos;s own game -- a specialist reads strongly positive for what suits him and negative for what
        doesn&apos;t, while an all-rounder sits near zero everywhere.
      </p>

      <h3>Starting Five</h3>
      <div className="player-cards">
        {starters.map((player) => (
          <PlayerRevealCard key={player.id} player={player} systemFits={systemFitsFor(player)} selectedSystemId={highlightedSystemId} starter />
        ))}
      </div>

      {bench.length > 0 && (
        <>
          <h3>Bench</h3>
          <div className="player-cards">
            {bench.map((player) => (
              <PlayerRevealCard key={player.id} player={player} systemFits={systemFitsFor(player)} selectedSystemId={highlightedSystemId} starter={false} />
            ))}
          </div>
        </>
      )}

      {props.mode === 'draft-system' ? (
        <>
          <h2>Pick Your System</h2>
          <p className="section-note">
            Scored against the roster above, weighted by projected minutes -- your rotation is part of the answer. The big number is the synergy
            score you&apos;d lock in: {SYNERGY_NEUTRAL} is neutral, and every point above or below nudges offensive strength by 0.4% (capped at
            &plusmn;10%). Each row shows how heavily the system leans on a play call and how far above or below its own baseline this roster
            grades there -- talent alone is worth nothing here, only the match.
          </p>
          <div className="draft-options system-options">
            {scoredSystems.map((s) => (
              <SystemChoiceCard
                key={s.id}
                playbook={s.playbook}
                synergy={s.synergy}
                breakdown={s.breakdown}
                selected={s.id === pick}
                onSelect={() => setPick(s.id)}
              />
            ))}
          </div>
          <button className="primary" disabled={!pick} onClick={() => pick && props.onLockSystem(pick)}>
            Lock In System
          </button>
        </>
      ) : (
        <>
          <h2>Your System</h2>
          <div className="draft-options system-options">
            {scoredSystems.map((s) => (
              <SystemChoiceCard key={s.id} playbook={s.playbook} synergy={s.synergy} breakdown={s.breakdown} selected />
            ))}
          </div>
          <div className="stretch-actions">
            <button className="primary" onClick={props.onBeginSeason}>
              Begin Season
            </button>
            <button onClick={props.onSimSeason}>Sim First Stretch</button>
          </div>
        </>
      )}
    </main>
  )
}
