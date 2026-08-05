import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { OFFENSIVE_PLAYBOOKS, type SystemId } from '../../data/presets'
import { clearRunBundle, loadRunBundle, saveRunBundle, type RunBundle } from '../../data/persistence/runRepository'
import { defaultRng } from '../../engine/rng'
import { generateLeague } from '../../engine/generator/randomLeague'
import { pickWorstTeamId } from '../../run/assignWorstTeam'
import { HOUSE_RULE_DRAFT_SIZE, QUIRK_DRAFT_SIZE, RUN_SEASON_LENGTH, RUN_TEAM_COUNT, SYSTEM_DRAFT_SIZE } from '../../run/constants'
import { pickRandomMarketSize } from '../../run/marketSize'
import { createRun } from '../../run/runState'
import { applyPlayerCamp, applyTeamCamp, generateShopOffers, openShopVisit, type ShopTier } from '../../run/shop'
import { simulateRunSeason } from '../../run/simulateRunSeason'
import { applyHouseRule, pickRandomHouseRules, type HouseRuleId } from '../../run/variation/houseRules'
import { applyRosterQuirk, pickRandomRosterQuirks, type RosterQuirkId } from '../../run/variation/rosterQuirks'
import { computeInitialSynergyScore, pickRandomSystems } from '../../run/variation/systemDraft'
import { RunContext, type PendingDraft, type RunContextValue } from './runContext.core'

export function RunProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<RunBundle | null>(null)
  const [draft, setDraft] = useState<PendingDraft | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRunBundle().then((loaded) => {
      setBundle(loaded)
      setLoading(false)
    })
  }, [])

  const beginDraft = useCallback(async () => {
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
      }
      await saveRunBundle(newBundle)
      setBundle(newBundle)
      setDraft(null)
    },
    [draft],
  )

  const simSeason = useCallback(async () => {
    if (!bundle) return
    const result = simulateRunSeason(bundle.run, bundle.league, bundle.teams, bundle.players, defaultRng)
    const updatedBundle: RunBundle = {
      run: result.run,
      league: result.league,
      teams: result.teams,
      players: result.players,
      games: result.games,
      lastSeasonTargetHit: result.targetHit,
      lastWildcardEvent: result.wildcardEvent,
      lastBudgetEarned: result.budgetEarned,
      shop: null,
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  const openShop = useCallback(async () => {
    if (!bundle) return
    const roster = bundle.players.filter((p) => p.teamId === bundle.run.teamId)
    const tier: ShopTier = bundle.lastSeasonTargetHit ? 'expanded' : 'condensed'
    const updatedBundle: RunBundle = { ...bundle, shop: openShopVisit(tier, roster, defaultRng) }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  const buyShopOffer = useCallback(
    async (offerId: string) => {
      if (!bundle?.shop) return
      const offer = bundle.shop.offers.find((o) => o.id === offerId)
      if (!offer || bundle.run.budget < offer.cost) return

      const updatedPlayers =
        offer.type === 'player-camp'
          ? applyPlayerCamp(bundle.players, offer.playerId!, defaultRng)
          : applyTeamCamp(bundle.players, bundle.run.teamId, defaultRng)

      // Camps grow synergy from where the draft-time roster fit left it (Team.synergyScore's doc
      // comment flags camps as one of the systems expected to feed back into it) -- recomputed the
      // same way the initial draft-time score was, from the (now camp-boosted) roster's fit to the
      // team's drafted system, not a parallel invented bump.
      const team = bundle.teams.find((t) => t.id === bundle.run.teamId)
      const updatedTeams = team
        ? bundle.teams.map((t) =>
            t.id === team.id
              ? { ...t, synergyScore: computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS[t.offensiveStrategyId as SystemId], updatedPlayers.filter((p) => p.teamId === t.id)) }
              : t,
          )
        : bundle.teams

      const updatedBundle: RunBundle = {
        ...bundle,
        run: { ...bundle.run, budget: bundle.run.budget - offer.cost },
        players: updatedPlayers,
        teams: updatedTeams,
        shop: { ...bundle.shop, offers: bundle.shop.offers.filter((o) => o.id !== offerId) },
      }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle],
  )

  const rerollShop = useCallback(async () => {
    if (!bundle?.shop || bundle.shop.rerollsRemaining <= 0) return
    const roster = bundle.players.filter((p) => p.teamId === bundle.run.teamId)
    const updatedBundle: RunBundle = {
      ...bundle,
      shop: {
        tier: bundle.shop.tier,
        offers: generateShopOffers(bundle.shop.tier, roster, defaultRng),
        rerollsRemaining: bundle.shop.rerollsRemaining - 1,
      },
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  const value: RunContextValue = { bundle, draft, loading, beginDraft, confirmDraft, simSeason, openShop, buyShopOffer, rerollShop }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}
