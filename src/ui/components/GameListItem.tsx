import type { Game, Team, TeamId } from '../../data/types'
import type { TeamRecord } from '../../engine/schedule/standings'
import { formatOvertimeLabel } from '../formatOvertime'
import { TeamName } from './TeamName'

function TeamLabel({ team, fallback, isUserTeam, record }: { team?: Team; fallback: string; isUserTeam: boolean; record?: TeamRecord }) {
  return (
    <>
      {/* The abbreviation is the click target through to a scouting report: the schedule is where
          the opponent you are about to play is named, which makes it the natural place to go and
          look at them. The record stays outside the control -- it is context on the row, not part
          of the team's name. */}
      <TeamName team={team} label={team?.abbreviation} fallback={fallback} bold={isUserTeam} />
      {/* Record as of this game, so a finished row shows what it produced and an upcoming row shows
          what both sides carry into it. Hidden at 0-0, where it's noise rather than context. */}
      {record && record.wins + record.losses > 0 && (
        <span className="team-record">
          {' '}
          ({record.wins}-{record.losses})
        </span>
      )}
    </>
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
  homeRecord,
  awayRecord,
  userTeamId,
  canPlay = true,
  onSim,
  onWatchLive,
  onViewBoxScore,
}: {
  game: Game
  homeTeam?: Team
  awayTeam?: Team
  /** Each side's record as of this game (engine/schedule/standings.ts's recordsThroughGame).
   *  Optional so the component still renders anywhere a caller has no schedule context to hand. */
  homeRecord?: TeamRecord
  awayRecord?: TeamRecord
  userTeamId?: TeamId | null
  /** Whether this game is the one due next. Unplayed games further down the schedule still show
   *  their controls, disabled, so the affordance stays visible rather than the row looking inert. */
  canPlay?: boolean
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
        <TeamLabel team={awayTeam} fallback={game.awayTeamId} isUserTeam={game.awayTeamId === userTeamId} record={awayRecord} /> @{' '}
        <TeamLabel team={homeTeam} fallback={game.homeTeamId} isUserTeam={game.homeTeamId === userTeamId} record={homeRecord} />
      </td>
      <td>
        {game.isPlayed && game.result ? (
          <>
            <button className="score-chip" onClick={onViewBoxScore}>
              {game.result.awayScore}-{game.result.homeScore}
              {formatOvertimeLabel(game.result.overtimePeriods)}
            </button>
            {/* A filled pill rather than a coloured letter: this is the one thing on the row you
                scan a whole schedule for, and at a glance a run of W's and L's should read as a
                shape before it reads as text. */}
            {badge && <span className={`result-pill ${badge.className}`}>{badge.label}</span>}
          </>
        ) : (
          <>
            <button onClick={onSim} disabled={!canPlay} title={canPlay ? undefined : 'Games play in order'}>
              Sim
            </button>{' '}
            <button onClick={onWatchLive} disabled={!canPlay} title={canPlay ? undefined : 'Games play in order'}>
              Watch Live
            </button>
          </>
        )}
      </td>
    </tr>
  )
}
