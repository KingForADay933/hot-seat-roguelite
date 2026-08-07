import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AttributeKey, Game, GameId, PlayerId } from '../../data/types'
import { OFFENSIVE_PLAYBOOKS, type SystemId } from '../../data/presets'
import { clearRunBundle, loadRunBundle, saveRunBundle, type RunBundle } from '../../data/persistence/runRepository'
import { REGULATION_MINUTES } from '../../engine/constants'
import { defaultRng } from '../../engine/rng'
import { generateLeague } from '../../engine/generator/randomLeague'
import { clamp } from '../../engine/math'
import { pickWorstTeamId } from '../../run/assignWorstTeam'
import { beginSeason } from '../../run/beginSeason'
import { createChunkSimContext } from '../../run/chunkSimContext'
import { finalizeChunk } from '../../run/finalizeChunk'
import { resolveGame } from '../../run/resolveGame'
import { chunkRange } from '../../run/seasonChunks'
import { applyCoachingUpgrade, computeSynergyUpgradeBonus, pickCoachingUpgradeOffers, type CoachingUpgradeId } from '../../run/coachingUpgrades'
import {
  COACHING_UPGRADE_COST,
  CONSUMABLE_COST,
  CONSUMABLE_INVENTORY_CAPACITY,
  ENERGY_DRINK_SPONSORSHIP_BUDGET_BONUS,
  HOUSE_RULE_DRAFT_SIZE,
  PLAYER_CAMP_COST,
  QUIRK_DRAFT_SIZE,
  RUN_SEASON_LENGTH,
  RUN_TEAM_COUNT,
  SYSTEM_DRAFT_SIZE,
  TEAM_CAMP_COST,
} from '../../run/constants'
import { pickConsumableOffers, type ConsumableId } from '../../run/consumables'
import { pickRandomMarketSize } from '../../run/marketSize'
import { createRun } from '../../run/runState'
import { applyPlayerCamp, applyTeamCamp, openShopVisit, type ShopTier } from '../../run/shop'
import { simulateSeasonChunk } from '../../run/simulateSeasonChunk'
import { applyHouseRule, pickRandomHouseRules, type HouseRuleId } from '../../run/variation/houseRules'
import { applyRosterQuirk, pickRandomRosterQuirks, type RosterQuirkId } from '../../run/variation/rosterQuirks'
import { computeInitialSynergyScore, pickRandomSystems } from '../../run/variation/systemDraft'
import { RunContext, type LiveGame, type PendingDraft, type RunContextValue } from './runContext.core'

export function RunProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<RunBundle | null>(null)
  const [draft, setDraft] = useState<PendingDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [fireAcknowledged, setFireAcknowledged] = useState(false)
  const [liveGame, setLiveGame] = useState<LiveGame | null>(null)

  useEffect(() => {
    loadRunBundle().then((loaded) => {
      setBundle(loaded)
      setLoading(false)
    })
  }, [])

  const beginDraft = useCallback(async () => {
    setFireAcknowledged(false)
    setLiveGame(null)
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
        stretchInProgress: false,
        pendingChunkInsights: [],
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
      // The batch path skips the stretch screen entirely, so it never opens a stretch to close.
      stretchInProgress: false,
      pendingChunkInsights: [],
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  /**
   * Opens the stretch screen for the next chunk: generates the season if this is its first chunk,
   * then plays the chunk's AI-vs-AI games in bulk, leaving the GM's own games unplayed for them to
   * sim or watch one at a time.
   *
   * The AI games go now rather than at the checkpoint so that finishStretch has nothing left to do
   * but the GM's own remaining games -- and because there's nothing in them to watch anyway (see
   * runTeamChunkGames). No standings are shown mid-stretch, so the league running slightly ahead of
   * the GM's own results is never visible.
   */
  const beginStretch = useCallback(async () => {
    if (!bundle || bundle.stretchInProgress) return
    const { run, league, teams } = bundle

    let players = bundle.players
    let games = bundle.games
    // Only a season's first chunk rolls an event; later chunks clear the previous reveal so it
    // can't linger onto a second checkpoint screen.
    let wildcardEvent = null
    if (run.chunkInSeason === 0) {
      const started = beginSeason(run, league, players, defaultRng)
      players = started.players
      games = started.games
      wildcardEvent = started.wildcardEvent
    }

    const context = createChunkSimContext(run, league, teams, players)
    const { start, end } = chunkRange(games.length, run.chunkInSeason)
    const updatedGames = [...games]
    for (let i = start; i < end; i++) {
      const scheduled = games[i]
      if (scheduled.homeTeamId === run.teamId || scheduled.awayTeamId === run.teamId) continue
      updatedGames[i] = resolveGame(context, run, scheduled, defaultRng).game
    }

    const updatedBundle: RunBundle = {
      ...bundle,
      players,
      games: updatedGames,
      lastWildcardEvent: wildcardEvent,
      stretchInProgress: true,
      pendingChunkInsights: [],
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  /** Folds one just-resolved game back into the season and banks its insights for the checkpoint.
   *  Shared by simGame and commitLiveGame, which differ only in who played the game. */
  const applyResolvedGame = useCallback(
    async (forBundle: RunBundle, index: number, alreadyPlayed?: Game) => {
      const { run, league, teams, players } = forBundle
      const context = createChunkSimContext(run, league, teams, players)
      const resolved = resolveGame(context, run, forBundle.games[index], defaultRng, alreadyPlayed)

      const games = [...forBundle.games]
      games[index] = resolved.game

      const updatedBundle: RunBundle = {
        ...forBundle,
        games,
        pendingChunkInsights: [...forBundle.pendingChunkInsights, ...resolved.insights],
      }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [],
  )

  /** Index of a stretch game that's still awaiting resolution -- -1 for an unknown id or one that's
   *  already been played, which is how every action below no-ops on a stale click. */
  const unplayedGameIndex = useCallback((forBundle: RunBundle, gameId: GameId): number => {
    const index = forBundle.games.findIndex((g) => g.id === gameId)
    return index !== -1 && !forBundle.games[index].isPlayed ? index : -1
  }, [])

  const simGame = useCallback(
    async (gameId: GameId) => {
      if (!bundle?.stretchInProgress) return
      const index = unplayedGameIndex(bundle, gameId)
      if (index === -1) return
      await applyResolvedGame(bundle, index)
    },
    [bundle, applyResolvedGame, unplayedGameIndex],
  )

  /**
   * Hands the simcast screen everything it needs to play a game out possession by possession. The
   * in-flight game lives in React state only, never in the save: nothing is committed until the
   * final buzzer (commitLiveGame), so closing the tab mid-game leaves it simply unplayed rather than
   * half-recorded. The consumable-boosted context is captured here so the game the GM watches is
   * simulated under exactly the same conditions simGame would have used.
   */
  const watchGame = useCallback(
    (gameId: GameId) => {
      if (!bundle?.stretchInProgress) return
      const index = unplayedGameIndex(bundle, gameId)
      if (index === -1) return
      setLiveGame({
        game: bundle.games[index],
        context: createChunkSimContext(bundle.run, bundle.league, bundle.teams, bundle.players),
      })
    },
    [bundle, unplayedGameIndex],
  )

  const commitLiveGame = useCallback(
    async (played: Game) => {
      setLiveGame(null)
      if (!bundle?.stretchInProgress) return
      const index = unplayedGameIndex(bundle, played.id)
      if (index === -1) return
      await applyResolvedGame(bundle, index, played)
    },
    [bundle, applyResolvedGame, unplayedGameIndex],
  )

  const abandonLiveGame = useCallback(() => setLiveGame(null), [])

  /**
   * Closes the stretch: sims whatever the GM didn't get to and runs the chunk through finalizeChunk,
   * landing them on the checkpoint (or, on a season's last chunk, the season-end recap). Doubles as
   * the "sim the rest, I'm done watching" button, so it's valid with any number of games left.
   */
  const finishStretch = useCallback(async () => {
    if (!bundle?.stretchInProgress) return
    const { run, league, teams, players } = bundle

    const context = createChunkSimContext(run, league, teams, players)
    const { start, end } = chunkRange(bundle.games.length, run.chunkInSeason)
    const games = [...bundle.games]
    const insights = [...bundle.pendingChunkInsights]
    for (let i = start; i < end; i++) {
      if (games[i].isPlayed) continue
      const resolved = resolveGame(context, run, games[i], defaultRng)
      games[i] = resolved.game
      insights.push(...resolved.insights)
    }

    const outcome = finalizeChunk(run, league, teams, players, games, insights)
    const updatedBundle: RunBundle = {
      run: outcome.run,
      league: outcome.league,
      teams: outcome.teams,
      players: outcome.players,
      games: outcome.games,
      lastSeasonTargetHit: outcome.seasonComplete ? outcome.targetHit : bundle.lastSeasonTargetHit,
      lastBudgetEarned: outcome.seasonComplete ? outcome.budgetEarned : bundle.lastBudgetEarned,
      // Rolled back when the stretch opened, not here -- carried through so the checkpoint screen
      // can still reveal it.
      lastWildcardEvent: bundle.lastWildcardEvent,
      shop: null,
      lastChunkInsights: outcome.chunkInsights,
      stretchInProgress: false,
      pendingChunkInsights: [],
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

  const buyConsumable = useCallback(
    async (consumableId: ConsumableId) => {
      if (!bundle?.shop) return
      if (!bundle.shop.consumableOffers.includes(consumableId)) return
      if (bundle.run.consumableInventory.length >= CONSUMABLE_INVENTORY_CAPACITY) return
      if (bundle.run.budget < CONSUMABLE_COST) return

      // Offers aren't removed after a buy (unlike coaching upgrades) -- duplicates in inventory
      // are fine, so the same rolled card can be bought more than once in a visit.
      const updatedBundle: RunBundle = {
        ...bundle,
        run: {
          ...bundle.run,
          budget: bundle.run.budget - CONSUMABLE_COST,
          consumableInventory: [...bundle.run.consumableInventory, consumableId],
        },
      }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle],
  )

  const rerollConsumableOffers = useCallback(async () => {
    if (!bundle?.shop) return
    if (bundle.shop.consumableRerollsRemaining <= 0) return

    const consumableOffers = pickConsumableOffers(bundle.shop.consumableOffers.length, defaultRng)
    const updatedBundle: RunBundle = {
      ...bundle,
      shop: { ...bundle.shop, consumableOffers, consumableRerollsRemaining: bundle.shop.consumableRerollsRemaining - 1 },
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  /** Burns one held consumable for the season about to start (Section 8.7's "loadout" step) --
   *  moves one instance from consumableInventory to activeConsumablesThisSeason, which
   *  simulateSeasonChunk reads on every chunk of the upcoming season. Energy Drink Sponsorship is
   *  the one card whose effect fires here immediately (a budget bump) rather than at sim time --
   *  see applyConsumableEffect's doc comment. */
  const activateConsumable = useCallback(
    async (consumableId: ConsumableId) => {
      if (!bundle) return
      const inventoryIndex = bundle.run.consumableInventory.indexOf(consumableId)
      if (inventoryIndex === -1) return

      const consumableInventory = [...bundle.run.consumableInventory]
      consumableInventory.splice(inventoryIndex, 1)
      const budgetBonus = consumableId === 'energy-drink-sponsorship' ? ENERGY_DRINK_SPONSORSHIP_BUDGET_BONUS : 0

      const updatedBundle: RunBundle = {
        ...bundle,
        run: {
          ...bundle.run,
          budget: bundle.run.budget + budgetBonus,
          consumableInventory,
          activeConsumablesThisSeason: [...bundle.run.activeConsumablesThisSeason, consumableId],
        },
      }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle],
  )

  const acknowledgeFired = useCallback(() => setFireAcknowledged(true), [])

  const value: RunContextValue = {
    bundle,
    draft,
    loading,
    fireAcknowledged,
    liveGame,
    acknowledgeFired,
    beginDraft,
    confirmDraft,
    simSeasonChunk,
    beginStretch,
    simGame,
    watchGame,
    commitLiveGame,
    abandonLiveGame,
    finishStretch,
    setRotationMinutes,
    setTrainingFocus,
    openShop,
    buyPlayerCamp,
    buyTeamCamp,
    buyCoachingUpgrade,
    rerollUpgradeOffers,
    buyConsumable,
    rerollConsumableOffers,
    activateConsumable,
  }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}
