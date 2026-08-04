import type { Game, PlayerId } from '../../data/types'

/**
 * Sums each player's minutesPlayed across every played game's box score this season. Must run
 * before rollover discards the completed season's games -- possession logs/box scores are a
 * rolling window (Section 6), so this is the only point this data exists.
 */
export function aggregateSeasonMinutes(games: Game[]): Map<PlayerId, number> {
  const minutesByPlayer = new Map<PlayerId, number>()

  for (const game of games) {
    if (!game.isPlayed || !game.result) continue
    for (const line of [...game.result.boxScore.home, ...game.result.boxScore.away]) {
      minutesByPlayer.set(line.playerId, (minutesByPlayer.get(line.playerId) ?? 0) + line.minutesPlayed)
    }
  }

  return minutesByPlayer
}
