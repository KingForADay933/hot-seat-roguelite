import { createId } from '../../data/ids'
import type { Game, LeagueId, TeamId } from '../../data/types'
import { SCHEDULE_GAP_DAYS, SCHEDULE_GAP_WEIGHTS } from '../constants'
import type { Rng } from '../rng'

/** Classic circle-method round robin: n-1 rounds, each team playing exactly once per round. */
function buildRoundRobinRounds(teamIds: TeamId[]): [TeamId, TeamId][][] {
  const n = teamIds.length
  const arr = [...teamIds]
  const rounds: [TeamId, TeamId][][] = []

  for (let round = 0; round < n - 1; round++) {
    const roundGames: [TeamId, TeamId][] = []
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i]
      const away = arr[n - 1 - i]
      // Alternate which side is "home" by round parity for a roughly balanced home/away split.
      roundGames.push(round % 2 === 0 ? [home, away] : [away, home])
    }
    rounds.push(roundGames)

    const fixed = arr[0]
    const rest = arr.slice(1)
    rest.unshift(rest.pop() as TeamId)
    arr.splice(0, arr.length, fixed, ...rest)
  }

  return rounds
}

/** Cumulative-weight roll over SCHEDULE_GAP_DAYS/SCHEDULE_GAP_WEIGHTS -- mostly a normal rest day
 *  or two between rounds, occasionally a back-to-back or an extra day off. */
function rollGapDays(rng: Rng): number {
  const roll = rng()
  let cumulative = 0
  for (let i = 0; i < SCHEDULE_GAP_DAYS.length; i++) {
    cumulative += SCHEDULE_GAP_WEIGHTS[i]
    if (roll < cumulative) return SCHEDULE_GAP_DAYS[i]
  }
  return SCHEDULE_GAP_DAYS[SCHEDULE_GAP_DAYS.length - 1]
}

/**
 * Builds an unplayed schedule sized to exactly `seasonLength` games per team. One round-robin
 * cycle gives n-1 games per team; a second cycle with home/away flipped is appended so longer
 * seasons stay balanced, and the combined cycle repeats if `seasonLength` exceeds its length.
 *
 * Every round has every team playing exactly once (round-robin's defining property), so rounds
 * -- not individual team matchups -- are the unit of calendar spacing here: consecutive rounds
 * are 1-3 days apart (rollGapDays), giving the whole league a realistic mix of rest days and
 * occasional back-to-backs instead of a game every single day.
 */
export function generateSchedule(
  leagueId: LeagueId,
  teamIds: TeamId[],
  seasonLength: number,
  rng: Rng,
  startDate: Date = new Date(),
): Game[] {
  if (teamIds.length < 2) throw new Error('Need at least 2 teams to build a schedule')
  if (teamIds.length % 2 !== 0) throw new Error('Schedule generation requires an even number of teams')

  const rounds = buildRoundRobinRounds(teamIds)
  const reversedRounds = rounds.map((round) => round.map(([home, away]): [TeamId, TeamId] => [away, home]))
  const fullCycle = [...rounds, ...reversedRounds]

  const games: Game[] = []
  let currentDate = new Date(startDate)

  for (let roundIndex = 0; roundIndex < seasonLength; roundIndex++) {
    if (roundIndex > 0) {
      currentDate = new Date(currentDate)
      currentDate.setDate(currentDate.getDate() + rollGapDays(rng))
    }
    const round = fullCycle[roundIndex % fullCycle.length]

    for (const [homeTeamId, awayTeamId] of round) {
      games.push({
        id: createId('game'),
        leagueId,
        homeTeamId,
        awayTeamId,
        date: currentDate.toISOString(),
        isPlayed: false,
        result: null,
        possessionLog: [],
        isSaved: false,
      })
    }
  }

  return games
}
