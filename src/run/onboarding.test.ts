import { describe, expect, it } from 'vitest'
import { allSpotsSeen, hasSeenSpot, isOnboardingActive, ONBOARDING_SPOTS, seenSpots, withOnboardingSkipped, withSpotSeen } from './onboarding'

const everySpot = ONBOARDING_SPOTS.map((spot) => spot.id)

describe('seenSpots', () => {
  it('reads a save written before onboarding existed as nothing seen', () => {
    // The whole reason RunState.onboarding is optional: isValidBundleShape rejects saves rather than
    // migrating them, so a required field would have invalidated every existing run. An absent key
    // has to mean "nothing seen", not crash a screen reading it.
    expect(seenSpots({})).toEqual([])
    expect(hasSeenSpot({}, 'my-team')).toBe(false)
    expect(allSpotsSeen({})).toBe(false)
  })
})

describe('withSpotSeen', () => {
  it('records a spot', () => {
    expect(withSpotSeen({ onboarding: [] }, 'insights')).toEqual(['insights'])
  })

  it('is idempotent, and returns the same array so a caller can skip the save', () => {
    // The hints fire on mount, so every revisit would otherwise write to IndexedDB for no reason --
    // and RunProvider's setters have a known same-tick clobbering window. Not writing avoids it.
    const run = { onboarding: ['insights' as const] }
    const next = withSpotSeen(run, 'insights')
    expect(next).toEqual(['insights'])
    expect(next).toBe(run.onboarding)
  })

  it('keeps what was already there', () => {
    expect(withSpotSeen({ onboarding: ['my-team'] }, 'watch-live')).toEqual(['my-team', 'watch-live'])
  })
})

describe('isOnboardingActive', () => {
  it('runs during the first season', () => {
    expect(isOnboardingActive({ seasonsPlayed: 0, onboarding: [] })).toBe(true)
    expect(isOnboardingActive({ seasonsPlayed: 0, onboarding: ['my-team'] })).toBe(true)
  })

  it('stops once the first season is over, even with everything unseen', () => {
    // A GM who ignored the prompts entirely should not carry them into season two.
    expect(isOnboardingActive({ seasonsPlayed: 1, onboarding: [] })).toBe(false)
    expect(isOnboardingActive({ seasonsPlayed: 4, onboarding: [] })).toBe(false)
  })

  it('stops early once everything has been found', () => {
    // The other exit, and the one that keeps this from being a nag: explore fast, be left alone.
    expect(allSpotsSeen({ onboarding: everySpot })).toBe(true)
    expect(isOnboardingActive({ seasonsPlayed: 0, onboarding: everySpot })).toBe(false)
  })

  it('is still running when only some spots are seen', () => {
    expect(isOnboardingActive({ seasonsPlayed: 0, onboarding: everySpot.slice(0, -1) })).toBe(true)
  })
})

describe('withOnboardingSkipped', () => {
  it('closes the window in one move', () => {
    // Skipping is expressed as "seen everything" rather than as a separate flag, so it has to satisfy
    // the same predicate the checklist and every hint already read -- otherwise a screen checking
    // only one of the two would keep prompting a GM who asked it to stop.
    const skipped = { onboarding: withOnboardingSkipped({ onboarding: [] }) }
    expect(allSpotsSeen(skipped)).toBe(true)
    expect(isOnboardingActive({ ...skipped, seasonsPlayed: 0 })).toBe(false)
  })

  it('never un-sees a hint-only spot already recorded', () => {
    // 'checkpoint' is not on the checklist, so a naive "replace with the checklist" would drop it and
    // the checkpoint hint would return for someone who had already read it.
    const skipped = withOnboardingSkipped({ onboarding: ['checkpoint'] })
    expect(skipped).toContain('checkpoint')
    expect(allSpotsSeen({ onboarding: skipped })).toBe(true)
  })

  it('does not duplicate spots already seen', () => {
    const skipped = withOnboardingSkipped({ onboarding: ['my-team', 'insights'] })
    expect(new Set(skipped).size).toBe(skipped.length)
  })
})

describe('the spot catalog', () => {
  it('gives every spot a route, not just a destination', () => {
    // A checklist that says "scout an opponent" without saying where to click is a worse screen than
    // no checklist -- the whole point is that these things are not discoverable.
    for (const spot of ONBOARDING_SPOTS) {
      expect(spot.label.length).toBeGreaterThan(0)
      expect(spot.where.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate ids', () => {
    expect(new Set(everySpot).size).toBe(everySpot.length)
  })
})
