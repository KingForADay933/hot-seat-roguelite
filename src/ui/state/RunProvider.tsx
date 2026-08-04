import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { clearRunBundle, loadRunBundle, saveRunBundle, type RunBundle } from '../../data/persistence/runRepository'
import { defaultRng } from '../../engine/rng'
import { generateLeague } from '../../engine/generator/randomLeague'
import { pickWorstTeamId } from '../../run/assignWorstTeam'
import { RUN_SEASON_LENGTH, RUN_TEAM_COUNT } from '../../run/constants'
import { createRun } from '../../run/runState'
import { simulateRunSeason } from '../../run/simulateRunSeason'
import { RunContext, type RunContextValue } from './runContext.core'

export function RunProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<RunBundle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRunBundle().then((loaded) => {
      setBundle(loaded)
      setLoading(false)
    })
  }, [])

  const startNewRun = useCallback(async () => {
    await clearRunBundle()
    const { league, teams, players } = generateLeague({
      teamCount: RUN_TEAM_COUNT,
      leagueName: 'Hot Seat League',
      rng: defaultRng,
      seasonLength: RUN_SEASON_LENGTH,
    })
    const teamId = pickWorstTeamId(teams, players)
    league.userControlledTeamId = teamId

    const newBundle: RunBundle = { run: createRun(teamId), league, teams, players, games: [], lastSeasonTargetHit: false }
    await saveRunBundle(newBundle)
    setBundle(newBundle)
  }, [])

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
    }
    await saveRunBundle(updatedBundle)
    setBundle(updatedBundle)
  }, [bundle])

  const value: RunContextValue = { bundle, loading, startNewRun, simSeason }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}
