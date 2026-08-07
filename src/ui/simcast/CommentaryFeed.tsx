import type { TeamId } from '../../data/types'
import type { FeedEntry } from './playbackState'

export function CommentaryFeed({ feed, userTeamId }: { feed: FeedEntry[]; userTeamId: TeamId }) {
  if (feed.length === 0) return <p className="commentary-empty">Waiting for the opening tip…</p>

  return (
    <ol className="commentary-feed">
      {feed.map((entry) => {
        const isUserPossession = entry.offenseTeamId === userTeamId
        const classNames = ['commentary-line']
        if (entry.pointsScored > 0) classNames.push(isUserPossession ? 'text-positive' : 'text-negative')
        if (isUserPossession) classNames.push('commentary-line-user')

        return (
          <li key={entry.possessionNumber} className={classNames.join(' ')}>
            <span className="commentary-period">{entry.periodLabel}</span>
            <span>{entry.text}</span>
          </li>
        )
      })}
    </ol>
  )
}
