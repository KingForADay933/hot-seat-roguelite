import { useEffect, useState } from 'react'
import { hasSeenSpot, isOnboardingActive, type OnboardingSpotId } from '../../run/onboarding'
import { useRun } from '../state/useRun'

/**
 * One line naming the thing on this screen a first-time GM would otherwise walk past, shown once.
 *
 * **Renders from a snapshot taken at mount, not from live state.** The component marks its spot seen
 * as a side effect, which updates the run, which re-renders the screen -- read live, the hint would
 * disappear in the same frame it appeared. Freezing the decision at mount is what lets it stay for
 * the visit and be gone on the next one.
 *
 * Renders nothing outside the onboarding window (run/onboarding.ts's isOnboardingActive), so every
 * call site can be unconditional and no screen has to know whether orientation is still running.
 */
export function OnboardingHint({ spot, children }: { spot: OnboardingSpotId; children: React.ReactNode }) {
  const { bundle, markOnboardingSeen } = useRun()
  const run = bundle?.run

  // Captured once. `useState` with an initialiser rather than `useMemo`, which React is free to
  // discard and recompute -- and a recomputed snapshot would be read against already-updated state.
  const [showOnMount] = useState(() => Boolean(run) && isOnboardingActive(run!) && !hasSeenSpot(run!, spot))

  useEffect(() => {
    if (showOnMount) void markOnboardingSeen(spot)
  }, [showOnMount, markOnboardingSeen, spot])

  if (!showOnMount) return null

  return (
    <p className="onboarding-hint" role="note">
      <span className="onboarding-hint-tag">New</span>
      <span>{children}</span>
    </p>
  )
}
