import type { League, Player, PlayerId, Team, TeamId } from '../data/types'
import { applyConsumableEffect } from './consumables/applyConsumableEffect'
import type { RunState } from './types'

/**
 * Folds every consumable in run.activeConsumablesThisSeason (Section 8.7) into local roster/team
 * copies, one card at a time. Deliberately separate from the caller's `players`/`teams`: the result
 * feeds ONLY the simulation, never what gets returned/persisted, so a consumable's effect exists
 * exactly as long as these copies do and never needs to be reverted. Energy Drink Sponsorship is a
 * no-op here (see applyConsumableEffect's doc comment) -- its budget bonus already landed on
 * run.budget back when it was activated.
 */
function applyActiveConsumables(run: RunState, teams: Team[], players: Player[]): { teams: Team[]; players: Player[] } {
  let simTeams = teams
  let simPlayers = players

  for (const consumableId of run.activeConsumablesThisSeason) {
    const team = simTeams.find((t) => t.id === run.teamId)
    if (!team) continue
    const { team: updatedTeam, players: updatedPlayers } = applyConsumableEffect(consumableId, team, simPlayers)
    simPlayers = updatedPlayers
    simTeams = simTeams.map((t) => (t.id === team.id ? updatedTeam : t))
  }

  return { teams: simTeams, players: simPlayers }
}

/**
 * Everything simulating one of a chunk's games needs, with this season's active consumables already
 * folded in. Sim-only: the boosted players/teams reachable through these lookups must never be
 * written back to the bundle.
 */
export interface ChunkSimContext {
  playersById: Map<PlayerId, Player>
  teamsById: Map<TeamId, Team>
  possessionsPerGame: number
}

/**
 * Builds the boosted lookups for a chunk's games. Rebuilt for every action that simulates something
 * -- entering a stretch, resolving a single game -- rather than once per season, which is what makes
 * an activated consumable's effect last the whole season (Section 8.7) instead of just the chunk it
 * was burned on: the boost is re-derived from run.activeConsumablesThisSeason every time, and
 * evaluateSeasonEnd clearing that list is what ends it.
 *
 * Deliberately cheap to rebuild and holds no cursor of its own, so it's safe to construct fresh on
 * each call rather than threading one instance through a whole chunk.
 */
export function createChunkSimContext(run: RunState, league: League, teams: Team[], players: Player[]): ChunkSimContext {
  const { teams: simTeams, players: simPlayers } = applyActiveConsumables(run, teams, players)

  return {
    playersById: new Map(simPlayers.map((p) => [p.id, p])),
    teamsById: new Map(simTeams.map((t) => [t.id, t])),
    possessionsPerGame: league.pacePresets.possessionsPerGame,
  }
}
