import type { Team, TeamId } from '../../data/types'
import { teamColorStyle } from '../teamColors'

/**
 * One side of the broadcast bar: a colour block carrying the team's own identity, its abbreviation,
 * and the score at display size.
 *
 * The colours come through as custom properties (ui/teamColors.ts) rather than inline backgrounds so
 * the CSS decides how they are spent -- which is what lets the user's side take an outline treatment
 * without either team's palette being hard-coded here.
 */
function Side({ team, score, isUserTeam }: { team: Team; score: number; isUserTeam: boolean }) {
  return (
    <div className={isUserTeam ? 'scoreboard-side scoreboard-side-user' : 'scoreboard-side'} style={teamColorStyle(team)}>
      <span className="scoreboard-team">
        <span className="scoreboard-chip" aria-hidden="true" />
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
  clockLabel,
  userTeamId,
}: {
  homeTeam: Team
  awayTeam: Team
  homeScore: number
  awayScore: number
  periodLabel: string
  clockLabel: string
  userTeamId: TeamId
}) {
  return (
    <div className="scoreboard">
      <Side team={awayTeam} score={awayScore} isUserTeam={awayTeam.id === userTeamId} />
      <span className="scoreboard-period">
        {periodLabel}
        <span className="scoreboard-clock">{clockLabel}</span>
      </span>
      <Side team={homeTeam} score={homeScore} isUserTeam={homeTeam.id === userTeamId} />
    </div>
  )
}
