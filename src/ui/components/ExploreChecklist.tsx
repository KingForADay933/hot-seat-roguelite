import { isOnboardingActive, ONBOARDING_SPOTS, seenSpots } from '../../run/onboarding'
import { useRun } from '../state/useRun'

/**
 * What a first-time GM has not found yet.
 *
 * Lives on the stretch screen because that is the hub -- the place a GM comes back to between every
 * game, and therefore the only screen guaranteed to be seen repeatedly during a first season.
 *
 * Every entry names a *route*, not just a destination. "Scout an opponent" without "click any team
 * name" would be a worse screen than no checklist at all, since not knowing where to click is the
 * entire problem being solved. Found items stay listed and tick off rather than vanishing, so the
 * list reads as progress instead of silently shrinking.
 */
export function ExploreChecklist() {
  const { bundle, skipOnboarding } = useRun()
  const run = bundle?.run
  if (!run || !isOnboardingActive(run)) return null

  const seen = seenSpots(run)
  const found = ONBOARDING_SPOTS.filter((spot) => seen.includes(spot.id)).length

  return (
    <section className="explore-checklist">
      <h2>
        Still to explore
        <span className="explore-count">
          {found} of {ONBOARDING_SPOTS.length}
        </span>
        {/* For anyone coming back who already knows the game. Records every spot as seen, which takes
            the hints down with it -- they read the same "is orientation running" predicate. */}
        <button className="link-button explore-skip" onClick={() => void skipOnboarding()}>
          I know my way around — skip this
        </button>
      </h2>
      <p className="section-note">
        A few things worth finding in your first season. This disappears once you have seen them all.
      </p>
      <ul>
        {ONBOARDING_SPOTS.map((spot) => {
          const done = seen.includes(spot.id)
          return (
            <li key={spot.id} className={done ? 'explore-item explore-item-done' : 'explore-item'}>
              <span className="explore-tick" aria-hidden="true">
                {done ? '✓' : ''}
              </span>
              <span>
                <strong>{spot.label}</strong>
                <span className="explore-where"> — {spot.where}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
