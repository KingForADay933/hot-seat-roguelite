import { useState } from 'react'
import type { GameId } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { SEASON_CHUNK_COUNT } from '../../run/constants'
import { nextPlayableGameId, runTeamChunkGames } from '../../run/seasonChunks'
import { BoxScoreTable } from '../components/BoxScoreTable'
import { GameListItem } from '../components/GameListItem'

/**
 * The stretch the GM is partway through: their own games for this chunk, each waiting to be simmed
 * outright or watched possession by possession. The chunk's AI-vs-AI games were already played when
 * the stretch opened (see beginStretch), so everything listed here is a game they have a stake in.
 *
 * Nothing is decided until the stretch closes -- standings and Coaching Insights land on the
 * checkpoint screen after finishStretch, not here, so a game's result is only ever revealed by the
 * GM resolving it.
 */
export function StretchScreen({
  bundle,
  onSimGame,
  onWatchGame,
  onFinish,
}: {
  bundle: RunBundle
  onSimGame: (gameId: GameId) => void
  onWatchGame: (gameId: GameId) => void
  onFinish: () => void
}) {
  const [openBoxScoreId, setOpenBoxScoreId] = useState<GameId | null>(null)
  const { run, teams, players, games } = bundle

  const team = teams.find((t) => t.id === run.teamId)
  if (!team) return null

  const stretchGames = runTeamChunkGames(games, run.chunkInSeason, run.teamId)
  const playedCount = stretchGames.filter((g) => g.isPlayed).length
  const allPlayed = playedCount === stretchGames.length
  // Only the earliest unplayed game is resolvable; the rest of the chunk is schedule, not a menu.
  const nextGameId = nextPlayableGameId(games, run.chunkInSeason, run.teamId)

  const openGame = stretchGames.find((g) => g.id === openBoxScoreId)
  const openResult = openGame?.result

  return (
    <main>
      <h1>
        Stretch {run.chunkInSeason + 1} of {SEASON_CHUNK_COUNT}
      </h1>
      <p>
        {team.city} {team.name} -- Season {run.seasonInStretch} of {run.seasonsPerStretch}, Stretch {run.stretchNumber} of the run.
      </p>
      <p>
        {playedCount} of {stretchGames.length} games played. They play in order -- sim the next one for the result, or watch it
        call by call.
      </p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Matchup</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {stretchGames.map((game) => (
              <GameListItem
                key={game.id}
                game={game}
                homeTeam={teams.find((t) => t.id === game.homeTeamId)}
                awayTeam={teams.find((t) => t.id === game.awayTeamId)}
                userTeamId={run.teamId}
                canPlay={game.id === nextGameId}
                onSim={() => onSimGame(game.id)}
                onWatchLive={() => onWatchGame(game.id)}
                onViewBoxScore={() => setOpenBoxScoreId((current) => (current === game.id ? null : game.id))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {openGame && openResult && (
        <>
          <h2>
            {teams.find((t) => t.id === openGame.awayTeamId)?.abbreviation} @{' '}
            {teams.find((t) => t.id === openGame.homeTeamId)?.abbreviation} -- Box Score
          </h2>
          <BoxScoreTable
            lines={openGame.homeTeamId === run.teamId ? openResult.boxScore.home : openResult.boxScore.away}
            players={players.filter((p) => p.teamId === run.teamId)}
          />
        </>
      )}

      <p>
        <button className="primary" onClick={onFinish}>
          {allPlayed ? 'Continue to Checkpoint' : 'Sim the Rest & Continue'}
        </button>
      </p>
    </main>
  )
}
