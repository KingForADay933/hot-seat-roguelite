import type { Team, TeamId } from '../../data/types'
import { TeamSwatch } from '../components/TeamSwatch'

function Side({ team, score, isUserTeam }: { team: Team; score: number; isUserTeam: boolean }) {
  return (
    <div className={isUserTeam ? 'scoreboard-side scoreboard-side-user' : 'scoreboard-side'}>
      <span className="scoreboard-team">
        <TeamSwatch team={team} />
        {team.abbreviation}
      </span>
      <span className="scoreboard-score">{score}</span>
    </div>
  )
}

export function Scoreboard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  periodLabel,
  userTeamId,
}: {
  homeTeam: Team
  awayTeam: Team
  homeScore: number
  awayScore: number
  periodLabel: string
  userTeamId: TeamId
}) {
  return (
    <div className="scoreboard">
      <Side team={awayTeam} score={awayScore} isUserTeam={awayTeam.id === userTeamId} />
      <span className="scoreboard-period">{periodLabel}</span>
      <Side team={homeTeam} score={homeScore} isUserTeam={homeTeam.id === userTeamId} />
    </div>
  )
}
