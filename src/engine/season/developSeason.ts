import type { Game, Player, Team } from '../../data/types'
import { computeSeasonDP } from '../development/dpFormula'
import { aggregateSeasonMinutes } from '../development/seasonMinutes'
import { computeEffectiveFocusWeights } from '../development/trainingFocus'
import { growPlayerOneSeason } from '../development/growPlayerOneSeason'
import { agePlayerOneYear } from './agePlayer'

/**
 * Full end-of-season pipeline for every player: aggregate this season's minutes from games,
 * compute net DP per player against their team's coaching/practice settings, resolve growth/decay
 * toward potential, then age. A player with no current team (no free-agency/waiving exists yet,
 * but teamId is nullable on the type) is aged only -- no DP inputs to compute against.
 */
export function developSeason(players: Player[], teams: Team[], games: Game[]): Player[] {
  const minutesByPlayer = aggregateSeasonMinutes(games)
  const teamsById = new Map(teams.map((t) => [t.id, t]))

  return players.map((player) => {
    const team = player.teamId ? teamsById.get(player.teamId) : undefined
    if (!team) return agePlayerOneYear(player)

    const totalSeasonMinutes = minutesByPlayer.get(player.id) ?? 0
    const netDP = computeSeasonDP(
      player.age,
      player.development.ageCurveStage,
      totalSeasonMinutes,
      team.practiceSettings,
      team.coaching.headCoachRating,
    )
    const focusWeights = computeEffectiveFocusWeights(player, team.trainingFocus[player.id])
    const grown = growPlayerOneSeason(player, netDP, focusWeights)
    return agePlayerOneYear(grown)
  })
}
