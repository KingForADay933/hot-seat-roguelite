import type { ReactNode } from 'react'

export interface Callout {
  label: string
  value: ReactNode
  /** Colours the figure where the number carries good or bad news on its own -- a scoring margin, a
   *  target hit. Left off where it does not: a game count is neither. */
  tone?: 'positive' | 'negative'
}

/**
 * A row of headline figures, given the lower-third treatment the scorebug uses.
 *
 * The screens this replaces were writing their numbers as prose -- "3 stretches cleared · 41-55
 * overall · best finish 4th in season 2 · $120 left unspent" was one sentence, and the run's whole
 * epitaph was in it. Numbers a GM is meant to take in at a glance should be sized to be taken in at
 * a glance; a sentence makes you read four facts to find the one you wanted.
 *
 * Falsy entries are dropped rather than rendered blank, so a caller can build the list inline with
 * conditionals (`bestSeason && {...}`) without guarding each one.
 */
export function StatCallouts({ items }: { items: (Callout | false | null | undefined)[] }) {
  const shown = items.filter((item): item is Callout => Boolean(item))
  if (shown.length === 0) return null

  return (
    <div className="stat-callouts">
      {shown.map((item) => (
        <div key={item.label} className="stat-callout">
          <span className={`stat-callout-value${item.tone ? ` text-${item.tone}` : ''}`}>{item.value}</span>
          <span className="stat-callout-label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
