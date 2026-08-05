import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { clearRunBundle, loadRunBundle, saveRunBundle, type RunBundle } from '../../data/persistence/runRepository'
import { defaultRng } from '../../engine/rng'
import { generateLeague } from '../../engine/generator/randomLeague'
import { pickWorstTeamId } from '../../run/assignWorstTeam'
import { HOUSE_RULE_DRAFT_SIZE, QUIRK_DRAFT_SIZE, RUN_SEASON_LENGTH, RUN_TEAM_COUNT } from '../../run/constants'
import { createRun } from '../../run/runState'
import { simulateRunSeason } from '../../run/simulateRunSeason'
import { applyHouseRule, pickRandomHouseRules, type HouseRuleId } from '../../run/variation/houseRules'
import { applyRosterQuirk, pickRandomRosterQuirks, type RosterQuirkId } from '../../run/variation/rosterQuirks'
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
    })
  }, [])

  const confirmDraft = useCallback(
    async (rosterQuirk: RosterQuirkId, houseRule: HouseRuleId) => {
      if (!draft) return
      const { league, teams, players, teamId } = draft

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

      const newBundle: RunBundle = {
        run: createRun(teamId, rosterQuirk, houseRule),
        league,
        teams: teamsAfterHouseRule,
        players: playersAfterHouseRule,
        games: [],
        lastSeasonTargetHit: false,
        lastWildcardEvent: null,
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
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  const value: RunContextValue = { bundle, draft, loading, beginDraft, confirmDraft, simSeason }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}
