/** [start, end) index range into a season's games array for one chunk. */
export interface SeasonChunkRange {
  start: number
  end: number
}

/**
 * Splits `totalGames` into `chunkCount` as-even-as-possible ranges, front-loading the remainder
 * (e.g. 33 games / 4 chunks -> 9/8/8/8, not 8/8/8/9) so the boundary the GM plans around never
 * moves due to a season length that doesn't divide evenly. RUN_SEASON_LENGTH (32) / SEASON_CHUNK_COUNT
 * (4) divides evenly today, but this doesn't assume that stays true.
 */
export function seasonChunkBoundaries(totalGames: number, chunkCount: number): SeasonChunkRange[] {
  const baseSize = Math.floor(totalGames / chunkCount)
  const remainder = totalGames % chunkCount

  const ranges: SeasonChunkRange[] = []
  let cursor = 0
  for (let i = 0; i < chunkCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0)
    ranges.push({ start: cursor, end: cursor + size })
    cursor += size
  }
  return ranges
}
