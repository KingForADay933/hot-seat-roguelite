import type { Team, TeamId } from '../../data/types'
import { teamColorStyle } from '../teamColors'
import type { FeedEntry } from './playbackState'

/**
 * The play-by-play.
 *
 * Each line carries a rule in the colour of the team that had the ball, which is a different
 * question from the one the green/red tone answers. The tone says whether a possession *scored and
 * whether that was good news for you*; the rule says *whose possession it was* -- and without it a
 * run of unscored possessions is an undifferentiated wall of sentences you have to read to work out
 * who is attacking.
 */
export function CommentaryFeed({
  feed,
  userTeamId,
  teamsById,
}: {
  feed: FeedEntry[]
  userTeamId: TeamId
  /** Both sides, for the possession rule. Optional so the feed still renders anywhere a caller has
   *  no team context -- it simply falls back to an uncoloured rule. */
  teamsById?: Map<TeamId, Team>
}) {
  if (feed.length === 0) return <p className="commentary-empty">Waiting for the opening tip…</p>

  return (
    <ol className="commentary-feed">
      {feed.map((entry) => {
        const isUserPossession = entry.offenseTeamId === userTeamId
        const classNames = ['commentary-line']
        if (entry.pointsScored > 0) classNames.push(isUserPossession ? 'text-positive' : 'text-negative')
        if (isUserPossession) classNames.push('commentary-line-user')

        const offense = teamsById?.get(entry.offenseTeamId)

        return (
          <li key={entry.possessionNumber} className={classNames.join(' ')} style={offense ? teamColorStyle(offense) : undefined}>
            <span className="commentary-period">{entry.periodLabel}</span>
            <span>{entry.text}</span>
          </li>
        )
      })}
    </ol>
  )
}
