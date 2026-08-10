/**
 * A headless harness that plays complete runs to firing, through the same pure pieces RunProvider
 * drives -- generation, season simulation, season evaluation, and a shop visit with a stated buy
 * policy. Kept because the run economy previously had no way to answer a question about itself.
 *
 * **Skipped by default, deliberately.** One sweep plays ~60 complete runs and takes about seven
 * minutes, which does not belong in a suite people run constantly. Drop the `.skip` when you have an
 * economy question, run this file on its own, and put it back.
 *
 * What it established when Fan Culture Buy-In was tuned (16 runs per arm, mid market):
 *
 * | arm | seasons survived | total earned | bought (season) | unspent at end |
 * |---|---|---|---|---|
 * | control | 10.38 | 3726 | -- | 204 |
 * | +100/season | 13.88 | 6327 | 4.14 (7/16) | 221 |
 * | +175/season | 13.00 | 6489 | 4.14 (7/16) | 401 |
 * | +250/season | 13.00 | 7295 | 4.14 (7/16) | 688 |
 *
 * Three things, two of which contradicted what the plan assumed:
 *
 * 1. **Runs are long** -- 10-14 seasons, and a GM can afford a $300 upgrade from around season 4.
 *    The worry that an investment card would have no runway was simply wrong.
 * 2. **The economy absorbs its income** once a GM actually shops. An earlier version of this harness
 *    bought only player camps and reported 58% of all earnings going unspent; player camps are capped
 *    per visit, so that was a lazy buy policy rather than a real surplus. Spending on upgrades, team
 *    camps and consumables too drops it to ~5%. Any future economy measurement needs the full policy.
 * 3. **Variance swamps the difference between candidate bonuses.** Seasons-delta is not even monotonic
 *    across 100/175/250, so this cannot justify a number bigger than the one with a clean payback
 *    story. The one signal that *is* monotonic is unspent budget tripling from 204 to 688, which
 *    argues for the low end: past some point the card prints money the shop cannot absorb.
 *
 * A caveat worth knowing before trusting a rerun: the arms share seeds only until the first purchase
 * diverges the rng stream, so runs are not paired after that, and the selection effect is real --
 * only runs that survive long enough to afford the card ever buy it.
 */
import { describe, it } from 'vitest'
import type { AttributeKey, Game, League, Player, Team } from '../data/types'
import { generateLeague } from '../engine/generator/randomLeague'
import { createSeededRng } from '../engine/rng'
import { pickWorstTeamId } from './assignWorstTeam'
import { applyCoachingUpgrade } from './coachingUpgrades'
import { consumableActivationBlockedReason } from './consumables'
import { COACHING_UPGRADE_COST, CONSUMABLE_COST, PLAYER_CAMP_COST, RUN_SEASON_LENGTH, RUN_TEAM_COUNT, TEAM_CAMP_COST } from './constants'
import { MARKET_SIZES, type MarketSizeId } from './marketSize'
import { createRun } from './runState'
import { openShopVisit } from './shop'
import { applyPlayerCamp, applyTeamCamp } from './shop/campEffect'
import { simulateSeasonChunk } from './simulateSeasonChunk'
import type { RunState } from './types'

interface RunOutcome {
  seasonsSurvived: number
  totalEarned: number
  /** Season number the GM first had COACHING_UPGRADE_COST in hand, or null if never. */
  firstAffordableSeason: number | null
  /** Season the card was actually bought, or null. */
  boughtSeason: number | null
  /** Budget left unspent when the run ended -- money the shop had nothing to absorb. */
  unspentAtEnd: number
  campsBought: number
  teamCampsBought: number
  upgradesBought: number
  consumablesBought: number
}

const CAMP_ATTRIBUTES: AttributeKey[] = ['outsideShot', 'insideShot', 'perimeterDefense', 'rebounding', 'ballHandling']

/**
 * Plays one whole run to firing, through the same pure pieces RunProvider drives.
 *
 * `buyCard` picks the arm: false is the control (camps only), true buys Fan Culture Buy-In the first
 * time it is both offered and affordable. Both arms share a seed, so the leagues, rosters and
 * schedules are identical up to the moment the arms diverge.
 */
function playRun(seed: number, marketSize: MarketSizeId, cardBonus: number | null): RunOutcome {
  const rng = createSeededRng(seed)
  const generated = generateLeague({ teamCount: RUN_TEAM_COUNT, leagueName: 'Harness', rng, seasonLength: RUN_SEASON_LENGTH })

  let league: League = generated.league
  let teams: Team[] = generated.teams
  let players: Player[] = generated.players
  let games: Game[] = []

  const teamId = pickWorstTeamId(teams, players)
  league = { ...league, userControlledTeamId: teamId }
  let run: RunState = createRun(teamId, 'low-ceiling', 'minutes-cap', marketSize)

  const outcome: RunOutcome = {
    seasonsSurvived: 0,
    totalEarned: 0,
    firstAffordableSeason: null,
    boughtSeason: null,
    unspentAtEnd: 0,
    campsBought: 0,
    teamCampsBought: 0,
    upgradesBought: 0,
    consumablesBought: 0,
  }

  // Hard stop so a run that somehow never ends can't hang the suite.
  while (run.status !== 'fired' && outcome.seasonsSurvived < 40) {
    const result = simulateSeasonChunk(run, league, teams, players, games, rng)
    run = result.run
    league = result.league
    teams = result.teams
    players = result.players
    games = result.games

    if (!result.seasonComplete) continue

    outcome.seasonsSurvived = run.seasonsPlayed
    outcome.totalEarned += result.budgetEarned
    if (cardBonus !== null && outcome.boughtSeason !== null) {
      // Emulated rather than routed through the real constant, so one process can sweep several
      // candidate values. The real path is unit-tested in budget.test.ts; this is for picking the number.
      const paid = Math.round(cardBonus * MARKET_SIZES[marketSize].budgetMultiplier)
      run = { ...run, budget: run.budget + paid }
      outcome.totalEarned += paid
    }
    if (outcome.firstAffordableSeason === null && run.budget >= COACHING_UPGRADE_COST) {
      outcome.firstAffordableSeason = run.seasonsPlayed
    }
    if (run.status === 'fired') break

    // --- Shop visit -------------------------------------------------------------------------
    const shop = openShopVisit(result.targetHit ? 'expanded' : 'condensed', run.coachingUpgrades, rng)

    if (cardBonus !== null && outcome.boughtSeason === null && run.budget >= COACHING_UPGRADE_COST && shop.upgradeOffers.includes('fan-culture-buy-in')) {
      run = { ...run, budget: run.budget - COACHING_UPGRADE_COST }
      outcome.boughtSeason = run.seasonsPlayed
    }

    // Spend everything, on everything the visit offers. A policy that only bought player camps made
    // the GM look far richer than they are: camps are capped per visit, so the leftover was an
    // artifact of not shopping rather than a real surplus. Both arms use this, so the comparison
    // stays fair either way -- but the absolute "unspent" figure only means something with it.
    const userTeam = () => teams.find((t) => t.id === teamId)

    for (const upgradeId of shop.upgradeOffers) {
      if (run.budget < COACHING_UPGRADE_COST) break
      if (run.coachingUpgrades.includes(upgradeId)) continue
      const team = userTeam()
      if (!team) break
      const applied = applyCoachingUpgrade(upgradeId, team, players)
      teams = teams.map((t) => (t.id === teamId ? applied.team : t))
      players = applied.players
      run = { ...run, budget: run.budget - COACHING_UPGRADE_COST, coachingUpgrades: [...run.coachingUpgrades, upgradeId] }
      outcome.upgradesBought += 1
    }

    if (run.budget >= TEAM_CAMP_COST && shop.teamCampsRemaining > 0) {
      players = applyTeamCamp(players, teamId, CAMP_ATTRIBUTES[Math.floor(rng() * CAMP_ATTRIBUTES.length)], rng)
      run = { ...run, budget: run.budget - TEAM_CAMP_COST }
      outcome.teamCampsBought += 1
    }

    let campsThisVisit = 0
    while (run.budget >= PLAYER_CAMP_COST && campsThisVisit < shop.playerCampsRemaining) {
      const roster = players.filter((p) => p.teamId === teamId)
      if (roster.length === 0) break
      const target = roster[Math.floor(rng() * roster.length)]
      const attribute = CAMP_ATTRIBUTES[Math.floor(rng() * CAMP_ATTRIBUTES.length)]
      players = applyPlayerCamp(players, target.id, attribute, rng)
      run = { ...run, budget: run.budget - PLAYER_CAMP_COST }
      campsThisVisit += 1
      outcome.campsBought += 1
    }

    // Consumables last -- cheapest, and bought-then-burned in the same visit the way a GM would.
    for (const consumableId of shop.consumableOffers) {
      if (run.budget < CONSUMABLE_COST) break
      if (consumableActivationBlockedReason(consumableId, run)) continue
      run = {
        ...run,
        budget: run.budget - CONSUMABLE_COST,
        activeConsumablesThisSeason: [...run.activeConsumablesThisSeason, consumableId],
      }
      outcome.consumablesBought += 1
    }
  }

  outcome.unspentAtEnd = run.budget
  return outcome
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length
}

describe.skip('run economy harness', () => {
  it('measures', { timeout: 900000 }, () => {
    const seeds = Array.from({ length: 16 }, (_, i) => i + 1)
    const bonuses = [100, 175, 250]
    const lines: string[] = [`${seeds.length} runs per arm, mid market, played to firing.`, '']

    const control = seeds.map((seed) => playRun(seed, 'mid', null))
    const byBonus = new Map<number, RunOutcome[]>()
    for (const bonus of bonuses) byBonus.set(bonus, seeds.map((seed) => playRun(seed, 'mid', bonus)))

    lines.push('| arm | seasons | total earned | bought (season) | runway after buy | unspent | camps | upgrades |')
    lines.push('|---|---|---|---|---|---|---|---|')

    const row = (label: string, runs: RunOutcome[]) => {
      const bought = runs.filter((r) => r.boughtSeason !== null)
      const runway = mean(bought.map((r) => r.seasonsSurvived - (r.boughtSeason ?? 0)))
      lines.push(
        `| ${label} | ${mean(runs.map((r) => r.seasonsSurvived)).toFixed(2)} | ${mean(runs.map((r) => r.totalEarned)).toFixed(0)} | ` +
          `${bought.length > 0 ? mean(bought.map((r) => r.boughtSeason ?? 0)).toFixed(2) : '--'} (${bought.length}/${runs.length}) | ` +
          `${runway.toFixed(2)} | ${mean(runs.map((r) => r.unspentAtEnd)).toFixed(0)} | ` +
          `${mean(runs.map((r) => r.campsBought)).toFixed(1)} | ${mean(runs.map((r) => r.upgradesBought)).toFixed(1)} |`,
      )
    }

    row('control', control)
    for (const bonus of bonuses) row(`+${bonus}/season`, byBonus.get(bonus) ?? [])

    lines.push('', '## against the 300 cost', '')
    const controlEarned = mean(control.map((r) => r.totalEarned))
    const controlSeasons = mean(control.map((r) => r.seasonsSurvived))
    for (const bonus of bonuses) {
      const runs = byBonus.get(bonus) ?? []
      const delta = mean(runs.map((r) => r.totalEarned)) - controlEarned
      lines.push(
        `- **+${bonus}/season**: earned delta ${delta.toFixed(0)}, net ${(delta - COACHING_UPGRADE_COST).toFixed(0)} · ` +
          `seasons delta ${(mean(runs.map((r) => r.seasonsSurvived)) - controlSeasons).toFixed(2)}`,
      )
    }

    // Printed rather than written to a file: node:fs needs @types/node, and adding those would
    // change setTimeout's type across the browser code for the sake of a harness. Run this file on
    // its own with --reporter=verbose if your reporter swallows it.
    console.log(lines.join('\n'))
  })
})

