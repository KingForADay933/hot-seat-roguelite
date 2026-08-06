import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AttributeKey, PlayerId } from '../../data/types'
import { OFFENSIVE_PLAYBOOKS, type SystemId } from '../../data/presets'
import { clearRunBundle, loadRunBundle, saveRunBundle, type RunBundle } from '../../data/persistence/runRepository'
import { REGULATION_MINUTES } from '../../engine/constants'
import { defaultRng } from '../../engine/rng'
import { generateLeague } from '../../engine/generator/randomLeague'
import { clamp } from '../../engine/math'
import { pickWorstTeamId } from '../../run/assignWorstTeam'
import { applyCoachingUpgrade, computeSynergyUpgradeBonus, pickCoachingUpgradeOffers, type CoachingUpgradeId } from '../../run/coachingUpgrades'
import {
  COACHING_UPGRADE_COST,
  HOUSE_RULE_DRAFT_SIZE,
  PLAYER_CAMP_COST,
  QUIRK_DRAFT_SIZE,
  RUN_SEASON_LENGTH,
  RUN_TEAM_COUNT,
  SYSTEM_DRAFT_SIZE,
  TEAM_CAMP_COST,
} from '../../run/constants'
import { pickRandomMarketSize } from '../../run/marketSize'
import { createRun } from '../../run/runState'
import { applyPlayerCamp, applyTeamCamp, openShopVisit, type ShopTier } from '../../run/shop'
import { simulateSeasonChunk } from '../../run/simulateSeasonChunk'
import { applyHouseRule, pickRandomHouseRules, type HouseRuleId } from '../../run/variation/houseRules'
import { applyRosterQuirk, pickRandomRosterQuirks, type RosterQuirkId } from '../../run/variation/rosterQuirks'
import { computeInitialSynergyScore, pickRandomSystems } from '../../run/variation/systemDraft'
import { RunContext, type PendingDraft, type RunContextValue } from './runContext.core'

export function RunProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<RunBundle | null>(null)
  const [draft, setDraft] = useState<PendingDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [fireAcknowledged, setFireAcknowledged] = useState(false)

  useEffect(() => {
    loadRunBundle().then((loaded) => {
      setBundle(loaded)
      setLoading(false)
    })
  }, [])

  const beginDraft = useCallback(async () => {
    setFireAcknowledged(false)
    await clearRunBundle()
    const { league, teams, players } = generateLeague({
      teamCount: RUN_TEAM_COUNT,
      leagueName: 'Hot Seat League',
      rng: defaultRng,
      seasonLength: RUN_SEASON_LENGTH,
    })
    const teamId = pickWorstTeamId(teams, players)
    league.userControlledTeamId = teamId

    setBundle(null)
    setDraft({
      league,
      teams,
      players,
      teamId,
      rosterQuirkOptions: pickRandomRosterQuirks(QUIRK_DRAFT_SIZE, defaultRng),
      houseRuleOptions: pickRandomHouseRules(HOUSE_RULE_DRAFT_SIZE, defaultRng),
      systemOptions: pickRandomSystems(SYSTEM_DRAFT_SIZE, defaultRng),
      marketSize: pickRandomMarketSize(defaultRng),
    })
  }, [])

  const confirmDraft = useCallback(
    async (rosterQuirk: RosterQuirkId, houseRule: HouseRuleId, system: SystemId) => {
      if (!draft) return
      const { league, teams, players, teamId, marketSize } = draft

      const rosterAfterQuirk = applyRosterQuirk(
        rosterQuirk,
        players.filter((p) => p.teamId === teamId),
        defaultRng,
      )
      const rosterAfterQuirkById = new Map(rosterAfterQuirk.map((p) => [p.id, p]))
      const playersAfterQuirk = players.map((p) => rosterAfterQuirkById.get(p.id) ?? p)

      const userTeam = teams.find((t) => t.id === teamId)!
      const { team: teamAfterHouseRule, players: playersAfterHouseRule } = applyHouseRule(houseRule, userTeam, playersAfterQuirk)

      // Synergy is computed from the roster's FINAL state -- after both the quirk's attribute
      // shifts and the house rule's roster cuts -- so it reflects what the team actually is, not
      // its pre-draft starting point.
      const finalRoster = playersAfterHouseRule.filter((p) => p.teamId === teamId)
      const synergyScore = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS[system], finalRoster)
      const teamWithSystem = { ...teamAfterHouseRule, offensiveStrategyId: system, synergyScore }
      const teamsAfterHouseRule = teams.map((t) => (t.id === teamId ? teamWithSystem : t))

      const newBundle: RunBundle = {
        run: createRun(teamId, rosterQuirk, houseRule, marketSize),
        league,
        teams: teamsAfterHouseRule,
        players: playersAfterHouseRule,
        games: [],
        lastSeasonTargetHit: false,
        lastWildcardEvent: null,
        lastBudgetEarned: 0,
        shop: null,
        lastChunkInsights: [],
      }
      await saveRunBundle(newBundle)
      setBundle(newBundle)
      setDraft(null)
    },
    [draft],
  )

  const simSeasonChunk = useCallback(async () => {
    if (!bundle) return
    const result = simulateSeasonChunk(bundle.run, bundle.league, bundle.teams, bundle.players, bundle.games, defaultRng)
    const updatedBundle: RunBundle = {
      run: result.run,
      league: result.league,
      teams: result.teams,
      players: result.players,
      games: result.games,
      // Only the season's last chunk actually determines these -- every other chunk carries the
      // bundle's existing values forward untouched rather than overwriting them with placeholders.
      lastSeasonTargetHit: result.seasonComplete ? result.targetHit : bundle.lastSeasonTargetHit,
      lastBudgetEarned: result.seasonComplete ? result.budgetEarned : bundle.lastBudgetEarned,
      // Non-null only on the chunk that actually rolled it (a season's first) -- null on every
      // other chunk, which naturally clears a stale reveal off the following chunk's screen.
      lastWildcardEvent: result.wildcardEvent,
      shop: null,
      lastChunkInsights: result.chunkInsights,
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  const setRotationMinutes = useCallback(
    async (playerId: PlayerId, minutes: number) => {
      if (!bundle) return
      const clamped = clamp(Math.round(minutes), 0, REGULATION_MINUTES)
      const teams = bundle.teams.map((t) =>
        t.id === bundle.run.teamId ? { ...t, rotationMinutes: { ...t.rotationMinutes, [playerId]: clamped } } : t,
      )
      const updatedBundle: RunBundle = { ...bundle, teams }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle],
  )

  const setTrainingFocus = useCallback(
    async (playerId: PlayerId, attribute: AttributeKey | null) => {
      if (!bundle) return
      const teams = bundle.teams.map((t) => {
        if (t.id !== bundle.run.teamId) return t
        const trainingFocus = { ...t.trainingFocus }
        if (attribute) trainingFocus[playerId] = { [attribute]: 1 }
        else delete trainingFocus[playerId]
        return { ...t, trainingFocus }
      })
      const updatedBundle: RunBundle = { ...bundle, teams }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle],
  )

  const openShop = useCallback(async () => {
    if (!bundle) return
    const tier: ShopTier = bundle.lastSeasonTargetHit ? 'expanded' : 'condensed'
    const updatedBundle: RunBundle = { ...bundle, shop: openShopVisit(tier, bundle.run.coachingUpgrades, defaultRng) }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  /**
   * Shared by both camp purchases and coaching-upgrade purchases: recomputes synergy from the
   * (now boosted) roster's fit to the team's drafted system -- same computation the initial
   * draft-time score used, not a parallel invented bump (Team.synergyScore's doc comment flags
   * camps as feeding back into it) -- plus computeSynergyUpgradeBonus's flat bonus from any owned
   * Players' Coach / System Guru. The bonus has to be re-added here, every time, rather than
   * applied as a one-time mutation at purchase time: since this full recompute discards
   * synergyScore's previous value, a one-time mutation would get silently erased by the next camp
   * (or coaching-upgrade) purchase that runs through this same function.
   *
   * `baseTeams` defaults to forBundle.teams but can be overridden to recompute on top of a team
   * object that already carries another pending change this same action made (e.g. a coaching
   * upgrade's own roster/rating mutation) rather than the stale pre-mutation bundle.teams.
   */
  const teamsWithRecomputedSynergy = useCallback(
    (forBundle: RunBundle, updatedPlayers: RunBundle['players'], baseTeams: RunBundle['teams'] = forBundle.teams) => {
      const team = baseTeams.find((t) => t.id === forBundle.run.teamId)
      if (!team) return baseTeams
      const upgradeBonus = computeSynergyUpgradeBonus(forBundle.run.coachingUpgrades)
      return baseTeams.map((t) =>
        t.id === team.id
          ? {
              ...t,
              synergyScore:
                computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS[t.offensiveStrategyId as SystemId], updatedPlayers.filter((p) => p.teamId === t.id)) +
                upgradeBonus,
            }
          : t,
      )
    },
    [],
  )

  const buyPlayerCamp = useCallback(
    async (playerId: PlayerId, attribute: AttributeKey) => {
      if (!bundle?.shop) return
      if (bundle.shop.playerCampsRemaining <= 0 || bundle.run.budget < PLAYER_CAMP_COST) return

      const updatedPlayers = applyPlayerCamp(bundle.players, playerId, attribute, defaultRng)
      const updatedBundle: RunBundle = {
        ...bundle,
        run: { ...bundle.run, budget: bundle.run.budget - PLAYER_CAMP_COST },
        players: updatedPlayers,
        teams: teamsWithRecomputedSynergy(bundle, updatedPlayers),
        shop: { ...bundle.shop, playerCampsRemaining: bundle.shop.playerCampsRemaining - 1 },
      }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle, teamsWithRecomputedSynergy],
  )

  const buyTeamCamp = useCallback(
    async (attribute: AttributeKey) => {
      if (!bundle?.shop) return
      if (bundle.shop.teamCampsRemaining <= 0 || bundle.run.budget < TEAM_CAMP_COST) return

      const updatedPlayers = applyTeamCamp(bundle.players, bundle.run.teamId, attribute, defaultRng)
      const updatedBundle: RunBundle = {
        ...bundle,
        run: { ...bundle.run, budget: bundle.run.budget - TEAM_CAMP_COST },
        players: updatedPlayers,
        teams: teamsWithRecomputedSynergy(bundle, updatedPlayers),
        shop: { ...bundle.shop, teamCampsRemaining: bundle.shop.teamCampsRemaining - 1 },
      }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle, teamsWithRecomputedSynergy],
  )

  const buyCoachingUpgrade = useCallback(
    async (upgradeId: CoachingUpgradeId) => {
      if (!bundle?.shop) return
      if (!bundle.shop.upgradeOffers.includes(upgradeId)) return
      if (bundle.run.coachingUpgrades.includes(upgradeId)) return
      if (bundle.run.budget < COACHING_UPGRADE_COST) return

      const team = bundle.teams.find((t) => t.id === bundle.run.teamId)
      if (!team) return

      const { team: updatedTeam, players: updatedPlayers } = applyCoachingUpgrade(upgradeId, team, bundle.players)
      const updatedRun = {
        ...bundle.run,
        budget: bundle.run.budget - COACHING_UPGRADE_COST,
        coachingUpgrades: [...bundle.run.coachingUpgrades, upgradeId],
      }
      const teamsWithUpdatedTeam = bundle.teams.map((t) => (t.id === team.id ? updatedTeam : t))
      const runBundleForSynergy: RunBundle = { ...bundle, run: updatedRun }

      const updatedBundle: RunBundle = {
        ...bundle,
        run: updatedRun,
        players: updatedPlayers,
        teams: teamsWithRecomputedSynergy(runBundleForSynergy, updatedPlayers, teamsWithUpdatedTeam),
        shop: { ...bundle.shop, upgradeOffers: bundle.shop.upgradeOffers.filter((id) => id !== upgradeId) },
      }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle, teamsWithRecomputedSynergy],
  )

  const rerollUpgradeOffers = useCallback(async () => {
    if (!bundle?.shop) return
    if (bundle.shop.upgradeRerollsRemaining <= 0) return

    const upgradeOffers = pickCoachingUpgradeOffers(bundle.run.coachingUpgrades, bundle.shop.upgradeOffers.length, defaultRng)
    const updatedBundle: RunBundle = {
      ...bundle,
      shop: { ...bundle.shop, upgradeOffers, upgradeRerollsRemaining: bundle.shop.upgradeRerollsRemaining - 1 },
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  const acknowledgeFired = useCallback(() => setFireAcknowledged(true), [])

  const value: RunContextValue = {
    bundle,
    draft,
    loading,
    fireAcknowledged,
    acknowledgeFired,
    beginDraft,
    confirmDraft,
    simSeasonChunk,
    setRotationMinutes,
    setTrainingFocus,
    openShop,
    buyPlayerCamp,
    buyTeamCamp,
    buyCoachingUpgrade,
    rerollUpgradeOffers,
  }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}
