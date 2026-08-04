import type { Game, Team, TeamId } from '../../data/types'
import { formatOvertimeLabel } from '../formatOvertime'
import { TeamSwatch } from './TeamSwatch'

function TeamLabel({ team, fallback, isUserTeam }: { team?: Team; fallback: string; isUserTeam: boolean }) {
  return (
    <span className="team-name" style={isUserTeam ? { fontWeight: 700 } : undefined}>
      {team && <TeamSwatch team={team} />}
      {team?.abbreviation ?? fallback}
    </span>
  )
}

/** Null unless the game is played and involves the user's team -- mirrors the win/loss comparison
 *  computeStandings already uses (engine/schedule/standings.ts), not Team.record (dead, never
 *  updated after generation). */
function resultBadge(game: Game, userTeamId?: TeamId | null): { label: 'W' | 'L'; className: string } | null {
  if (!game.result || !userTeamId) return null
  if (game.homeTeamId !== userTeamId && game.awayTeamId !== userTeamId) return null

  const userIsHome = game.homeTeamId === userTeamId
  const userScore = userIsHome ? game.result.homeScore : game.result.awayScore
  const opponentScore = userIsHome ? game.result.awayScore : game.result.homeScore
  const isWin = userScore >= opponentScore
  return { label: isWin ? 'W' : 'L', className: isWin ? 'text-positive' : 'text-negative' }
}

export function GameListItem({
  game,
  homeTeam,
  awayTeam,
  userTeamId,
  onSim,
  onWatchLive,
  onViewBoxScore,
}: {
  game: Game
  homeTeam?: Team
  awayTeam?: Team
  userTeamId?: TeamId | null
  onSim: () => void
  onWatchLive: () => void
  onViewBoxScore: () => void
}) {
  const dateLabel = new Date(game.date).toLocaleDateString()
  const badge = resultBadge(game, userTeamId)

  return (
    <tr>
      <td>{dateLabel}</td>
      <td>
        <TeamLabel team={awayTeam} fallback={game.awayTeamId} isUserTeam={game.awayTeamId === userTeamId} /> @{' '}
        <TeamLabel team={homeTeam} fallback={game.homeTeamId} isUserTeam={game.homeTeamId === userTeamId} />
      </td>
      <td>
        {game.isPlayed && game.result ? (
          <>
            <button onClick={onViewBoxScore}>
              {game.result.awayScore}-{game.result.homeScore}
              {formatOvertimeLabel(game.result.overtimePeriods)}
            </button>
            {badge && (
              <span className={badge.className} style={{ fontWeight: 700, marginLeft: 4 }}>
                {badge.label}
              </span>
            )}
          </>
        ) : (
          <>
            <button onClick={onSim}>Sim</button> <button onClick={onWatchLive}>Watch Live</button>
          </>
        )}
      </td>
    </tr>
  )
}
