import type { ReactNode } from 'react'

/**
 * A screen section that can be folded away.
 *
 * Built on native `<details>`/`<summary>` rather than a `useState` toggle, and that is the whole
 * design: the element is already keyboard-operable, already announced as expandable by screen
 * readers, already has correct semantics for find-in-page, and takes its initial state from an
 * attribute. A hand-rolled version would be more code to get less.
 *
 * **Nothing is remembered.** Each call site declares whether it opens, and that is what you get every
 * time you arrive. The rule across the app is that anything you *act on* starts open and anything you
 * *consult* starts closed -- which is what makes a screen fit on arrival, and is not a preference to
 * be learned. It also keeps this out of the save file entirely.
 *
 * `summary` is what a folded section still tells you. A collapsed block with only a title makes you
 * open it to find out whether it was worth opening, which is a worse screen than the tall one it
 * replaced.
 */
export function Section({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string
  /** One line shown while collapsed -- enough to decide whether to open it. */
  summary?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="section" open={defaultOpen}>
      <summary className="section-head">
        <span className="section-title">{title}</span>
        {summary && <span className="section-summary">{summary}</span>}
      </summary>
      <div className="section-body">{children}</div>
    </details>
  )
}
