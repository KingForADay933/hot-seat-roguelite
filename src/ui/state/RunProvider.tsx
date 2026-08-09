import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AttributeKey, Game, GameId, PlayerId, RotationPlan } from '../../data/types'
import { DEFENSIVE_SCHEMES, OFFENSIVE_PLAYBOOKS, type DefensiveSchemeId, type SystemId } from '../../data/presets'
import { clearRunBundle, loadRunBundle, saveRunBundle, type RunBundle } from '../../data/persistence/runRepository'
import { defaultRng } from '../../engine/rng'
import { generateLeague } from '../../engine/generator/randomLeague'
import { pickWorstTeamId } from '../../run/assignWorstTeam'
import { beginSeason } from '../../run/beginSeason'
import { createChunkSimContext } from '../../run/chunkSimContext'
import { finalizeChunk } from '../../run/finalizeChunk'
import { resolveGame } from '../../run/resolveGame'
import { chunkRange, nextPlayableGameId } from '../../run/seasonChunks'
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
import { clampToPositionBudget } from '../../run/minutesBudget'
import { recordChunkInsights } from '../../run/runInsights'
import { createRun } from '../../run/runState'
import { applyPlayerCamp, applyTeamCamp, openShopVisit, type ShopTier } from '../../run/shop'
import { simulateSeasonChunk } from '../../run/simulateSeasonChunk'
import { applyHouseRule, pickRandomHouseRules, type HouseRuleId } from '../../run/variation/houseRules'
import { applyRosterQuirk, pickRandomRosterQuirks, type RosterQuirkId } from '../../run/variation/rosterQuirks'
import { computeInitialSynergyScore, pickRandomSystems } from '../../run/variation/systemDraft'
import { RunContext, type LiveGame, type PendingDraft, type PendingReveal, type RunContextValue } from './runContext.core'

export function RunProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<RunBundle | null>(null)
  const [draft, setDraft] = useState<PendingDraft | null>(null)
  const [reveal, setReveal] = useState<PendingReveal | null>(null)
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
    setReveal(null)
    setDraft({
      league,
      teams,
      players,
      teamId,
      rosterQuirkOptions: pickRandomRosterQuirks(QUIRK_DRAFT_SIZE, defaultRng),
      houseRuleOptions: pickRandomHouseRules(HOUSE_RULE_DRAFT_SIZE, defaultRng),
      marketSize: pickRandomMarketSize(defaultRng),
    })
  }, [])

  /**
   * Quits the run in progress and returns to the start screen. Same erasure beginDraft performs
   * before rolling a new league, split out so quitting and starting again are separate acts: a GM
   * walking away from a run shouldn't be dropped straight into another one's draft picks.
   *
   * There is nothing to keep -- the roguelite has no run history, and the fired epilogue is the
   * only retrospective it has ever shown -- so this is a delete, not an archive.
   */
  const abandonRun = useCallback(async () => {
    setFireAcknowledged(false)
    setLiveGame(null)
    await clearRunBundle()
    setBundle(null)
    setDraft(null)
    setReveal(null)
  }, [])

  /**
   * Phase one of setup. Both picks here rewrite the roster -- the quirk shifts attributes and can
   * re-age players, the house rule can swap starters or waive the back of the bench -- so they're
   * applied in that order and the result becomes the roster the reveal screen shows. No run is
   * created yet: without a system there's no synergy score to write, and the whole point of the
   * split is that the system is chosen against this roster rather than ahead of it.
   */
  const confirmDraft = useCallback(
    async (rosterQuirk: RosterQuirkId, houseRule: HouseRuleId) => {
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
      const teamsAfterHouseRule = teams.map((t) => (t.id === teamId ? teamAfterHouseRule : t))

      setDraft(null)
      setReveal({
        league,
        teams: teamsAfterHouseRule,
        players: playersAfterHouseRule,
        teamId,
        rosterQuirk,
        houseRule,
        marketSize,
        systemOptions: pickRandomSystems(SYSTEM_DRAFT_SIZE, defaultRng),
      })
    },
    [draft],
  )

  /**
   * Phase two of setup, and the first thing in a run that actually persists. Synergy is computed
   * from the roster's FINAL state -- after both the quirk's attribute shifts and the house rule's
   * roster cuts -- so it reflects what the team actually is, which is also exactly the roster the
   * GM was just looking at when they picked: the number shown on the system card is the number
   * that gets written here.
   */
  const lockSystem = useCallback(
    async (system: SystemId, defense: DefensiveSchemeId) => {
      if (!reveal) return
      const { league, teams, players, teamId, rosterQuirk, houseRule, marketSize } = reveal
      if (!reveal.systemOptions.includes(system)) return
      // Defence isn't drafted from a rolled hand, so the guard is membership of the whole catalogue
      // rather than of an offered subset -- but it is still checked, since this is the boundary
      // where an arbitrary id would otherwise reach a saved bundle.
      if (!(defense in DEFENSIVE_SCHEMES)) return

      const userTeam = teams.find((t) => t.id === teamId)
      if (!userTeam) return
      const finalRoster = players.filter((p) => p.teamId === teamId)
      const synergyScore = computeInitialSynergyScore(OFFENSIVE_PLAYBOOKS[system], finalRoster, userTeam)
      const teamsWithSystem = teams.map((t) =>
        t.id === teamId ? { ...t, offensiveStrategyId: system, defensiveStrategyId: defense, synergyScore } : t,
      )

      const newBundle: RunBundle = {
        run: createRun(teamId, rosterQuirk, houseRule, marketSize),
        league,
        teams: teamsWithSystem,
        players,
        games: [],
        lastSeasonTargetHit: false,
        lastWildcardEvent: null,
        lastBudgetEarned: 0,
        shop: null,
        lastChunkInsights: [],
        runInsights: [],
        stretchInProgress: false,
        pendingChunkInsights: [],
      }
      await saveRunBundle(newBundle)
      setBundle(newBundle)
      setReveal(null)
    },
    [reveal],
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
      // Stamped with the season these games belonged to -- bundle.league.seasonNumber, before the
      // chunk was finalized, since a season's last chunk rolls that number forward.
      runInsights: recordChunkInsights(bundle.runInsights, result.chunkInsights, bundle.league.seasonNumber, bundle.run.teamId),
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

  /**
   * Same, but also requires the game to be the one due next in the chunk -- the ordering rule the
   * stretch screen enforces visually (run/seasonChunks.ts's nextPlayableGameId).
   *
   * Enforced here as well so the invariant belongs to the state layer rather than to a disabled
   * attribute. Deliberately *not* applied to commitLiveGame: by then the GM has already watched the
   * game, and refusing to record it would lose real play rather than prevent anything.
   */
  const startableGameIndex = useCallback(
    (forBundle: RunBundle, gameId: GameId): number => {
      if (nextPlayableGameId(forBundle.games, forBundle.run.chunkInSeason, forBundle.run.teamId) !== gameId) return -1
      return unplayedGameIndex(forBundle, gameId)
    },
    [unplayedGameIndex],
  )

  const simGame = useCallback(
    async (gameId: GameId) => {
      if (!bundle?.stretchInProgress) return
      const index = startableGameIndex(bundle, gameId)
      if (index === -1) return
      await applyResolvedGame(bundle, index)
    },
    [bundle, applyResolvedGame, startableGameIndex],
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
      const index = startableGameIndex(bundle, gameId)
      if (index === -1) return
      setLiveGame({
        game: bundle.games[index],
        context: createChunkSimContext(bundle.run, bundle.league, bundle.teams, bundle.players),
      })
    },
    [bundle, startableGameIndex],
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
      // Same stamping as the batch path: `league` here is the pre-finalize bundle value.
      runInsights: recordChunkInsights(bundle.runInsights, outcome.chunkInsights, league.seasonNumber, run.teamId),
      stretchInProgress: false,
      pendingChunkInsights: [],
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  /**
   * Recomputes synergy from the roster's fit to the team's drafted system -- same computation the
   * initial draft-time score used, not a parallel invented bump (Team.synergyScore's doc comment
   * flags camps as feeding back into it) -- plus computeSynergyUpgradeBonus's flat bonus from any
   * owned Players' Coach / System Guru. The bonus has to be re-added here, every time, rather than
   * applied as a one-time mutation at purchase time: since this full recompute discards
   * synergyScore's previous value, a one-time mutation would get silently erased by the next
   * recompute that runs through this same function.
   *
   * Called by camp purchases, coaching-upgrade purchases, and rotation changes. That last one is
   * easy to miss: computeInitialSynergyScore is minutes-weighted (systemDraft's `availability`
   * turns rotation minutes into each player's share of every role), so who plays how much genuinely
   * moves the score -- inverting a depth chart swings it several points, which is a real chunk of
   * the offense multiplier. Leaving it out is what made the number on My Team go stale the moment
   * a GM touched a minutes box.
   *
   * `baseTeams` defaults to forBundle.teams but can be overridden to recompute on top of a team
   * object that already carries another pending change this same action made (e.g. a coaching
   * upgrade's own roster/rating mutation, or the rotation edit below) rather than the stale
   * pre-mutation bundle.teams.
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
                computeInitialSynergyScore(
                  OFFENSIVE_PLAYBOOKS[t.offensiveStrategyId as SystemId],
                  updatedPlayers.filter((p) => p.teamId === t.id),
                  t,
                ) + upgradeBonus,
            }
          : t,
      )
    },
    [],
  )

  const setRotationMinutes = useCallback(
    async (playerId: PlayerId, minutes: number) => {
      if (!bundle) return
      const team = bundle.teams.find((t) => t.id === bundle.run.teamId)
      if (!team) return
      // Bounded by what's left at this player's own position rather than by a flat 0-48, so the
      // minutes a GM hands out are minutes that actually exist to give (run/minutesBudget.ts), and
      // narrowed further by the run's house rule where one caps or floors a player's minutes.
      const roster = bundle.players.filter((p) => p.teamId === team.id)
      const clamped = clampToPositionBudget(team, roster, playerId, minutes, bundle.run.houseRule)
      const withNewMinutes = bundle.teams.map((t) =>
        t.id === bundle.run.teamId ? { ...t, rotationMinutes: { ...t.rotationMinutes, [playerId]: clamped } } : t,
      )
      // Recomputed on top of the just-edited teams, not bundle.teams -- the new minutes are the
      // whole input that changed.
      const teams = teamsWithRecomputedSynergy(bundle, bundle.players, withNewMinutes)
      const updatedBundle: RunBundle = { ...bundle, teams }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle, teamsWithRecomputedSynergy],
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

  /**
   * The GM's standing defensive instruction, changeable at any point in a run.
   *
   * One value, not a per-game override: a scheme is what the team defaults to defending in, so
   * changing it from a checkpoint, from My Team, or mid-broadcast all mean the same thing and all
   * persist. Synergy is deliberately not recomputed -- it scores the roster's fit to the *offensive*
   * playbook, and defence is no part of that number.
   *
   * A game already in progress is a separate matter: its generator captured the team as it was when
   * the tip went up, so SimcastScreen hands the same change to the running simulation as a
   * CoachingDirective as well as calling this.
   */
  const setDefensiveScheme = useCallback(
    async (schemeId: DefensiveSchemeId) => {
      if (!bundle) return
      if (!(schemeId in DEFENSIVE_SCHEMES)) return
      const teams = bundle.teams.map((t) => (t.id === bundle.run.teamId ? { ...t, defensiveStrategyId: schemeId } : t))
      const updatedBundle: RunBundle = { ...bundle, teams }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle],
  )

  const setRotationPlan = useCallback(
    async (plan: RotationPlan) => {
      if (!bundle) return
      const withNewPlan = bundle.teams.map((t) => (t.id === bundle.run.teamId ? { ...t, rotationPlan: plan } : t))
      // Recomputed on the just-edited teams for the same reason a minutes edit is: the chart is now
      // an input to computeInitialSynergyScore (systemDraft's `availability` reads charted spans
      // directly and prorates rotationMinutes across whatever the chart leaves Auto), so charting a
      // system's best-fit players into real minutes genuinely moves the score.
      const teams = teamsWithRecomputedSynergy(bundle, bundle.players, withNewPlan)
      const updatedBundle: RunBundle = { ...bundle, teams }
      await saveRunBundle(updatedBundle)
      setBundle(updatedBundle)
    },
    [bundle, teamsWithRecomputedSynergy],
  )

  const openShop = useCallback(async () => {
    if (!bundle) return
    const tier: ShopTier = bundle.lastSeasonTargetHit ? 'expanded' : 'condensed'
    const updatedBundle: RunBundle = { ...bundle, shop: openShopVisit(tier, bundle.run.coachingUpgrades, defaultRng) }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

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
    reveal,
    loading,
    fireAcknowledged,
    liveGame,
    acknowledgeFired,
    abandonRun,
    beginDraft,
    confirmDraft,
    lockSystem,
    simSeasonChunk,
    beginStretch,
    simGame,
    watchGame,
    commitLiveGame,
    abandonLiveGame,
    finishStretch,
    setRotationMinutes,
    setTrainingFocus,
    setRotationPlan,
    setDefensiveScheme,
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
