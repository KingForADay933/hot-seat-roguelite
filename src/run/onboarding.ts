import type { RunState } from './types'

/**
 * The short list of things a first-time GM will otherwise never find.
 *
 * Scoped to what is genuinely *optional*: the checkpoint, the shop and the season results arrive on
 * rails and cannot be missed, so they are not tracked. Everything here is reachable only by clicking
 * something that does not announce itself -- and two of those are self-inflicted. `.player-link`
 * deliberately inherits the surrounding text colour (its own comment explains why: in a dense roster
 * table "every row would light up, which reads as noise rather than as affordance"), and the
 * collapsible sections that made screens fit start folded. Both are right for a player who knows the
 * game and invisible to one who does not.
 */
export type ChecklistSpotId = 'my-team' | 'insights' | 'watch-live' | 'player-page' | 'scout-report'

/**
 * Everything a hint can be attached to, which is wider than the checklist.
 *
 * A screen the GM cannot miss still hides its mechanics -- the checkpoint arrives on rails and says
 * nothing about the fact that the controls beside the Insights are how you answer them. Those get a
 * hint but no checklist row, because listing "visit the screen the game takes you to" would be noise.
 *
 * The shop is deliberately *not* here. It first appears after season one has been evaluated, and
 * `seasonsPlayed` increments at that moment -- so the onboarding window has always closed by the time
 * a GM first sees it, and a hint there would be dead code. It is also the most self-describing screen
 * in the game, with a heading and a sentence over every section.
 */
export type OnboardingSpotId = ChecklistSpotId | 'checkpoint'

export interface OnboardingSpot {
  id: ChecklistSpotId
  /** What the GM is being sent to do, in the imperative. */
  label: string
  /** Where to do it -- the checklist is useless if it names a destination without a route. */
  where: string
}

export const ONBOARDING_SPOTS: OnboardingSpot[] = [
  { id: 'my-team', label: 'Open My Team', where: 'top-left nav — minutes, training, the rotation chart and your dials all live there' },
  { id: 'insights', label: 'Open Coaching Insights', where: 'top-left nav — what is working and what is not, updated after every game' },
  { id: 'watch-live', label: 'Watch a game live', where: 'the schedule below — a live game can be coached, a simmed one cannot' },
  { id: 'player-page', label: "Open a player's page", where: 'click any player name, anywhere in the game' },
  { id: 'scout-report', label: 'Scout an opponent', where: 'click any team name — see what they run before you play them' },
]

/** Seasons of a run during which the prompts show. One, by design: this is orientation, not a tutor. */
const ONBOARDING_SEASONS = 1

/**
 * What skipping records: every checklist spot at once.
 *
 * Deliberately expressed as "you have seen everything" rather than as a separate `skipped` flag.
 * There is already exactly one predicate deciding whether orientation is running, and a second piece
 * of state would mean every caller had to remember to check both -- the bug being that a screen which
 * checked only one would keep prompting a GM who had asked it to stop.
 */
export const ALL_CHECKLIST_SPOTS: ChecklistSpotId[] = ONBOARDING_SPOTS.map((spot) => spot.id)

export function seenSpots(run: Pick<RunState, 'onboarding'>): OnboardingSpotId[] {
  // Absent on every save written before onboarding existed, which reads as "nothing seen yet".
  return run.onboarding ?? []
}

export function hasSeenSpot(run: Pick<RunState, 'onboarding'>, spot: OnboardingSpotId): boolean {
  return seenSpots(run).includes(spot)
}

export function allSpotsSeen(run: Pick<RunState, 'onboarding'>): boolean {
  const seen = seenSpots(run)
  return ONBOARDING_SPOTS.every((spot) => seen.includes(spot.id))
}

/**
 * Whether the prompts are still running.
 *
 * Two ways out, whichever comes first: the first season ends, or the GM has found everything. The
 * second matters as much as the first -- a player who explores in ten minutes should not be nagged
 * for the rest of the season, and one who ignores the prompts entirely should not carry them into
 * season two.
 *
 * Single predicate on purpose. The hints and the checklist both read it, so they cannot disagree
 * about whether onboarding is happening.
 */
export function isOnboardingActive(run: Pick<RunState, 'onboarding' | 'seasonsPlayed'>): boolean {
  return run.seasonsPlayed < ONBOARDING_SEASONS && !allSpotsSeen(run)
}

/** Records a visit. Returns the same array when the spot is already known, which is what lets the
 *  caller skip a pointless save -- see RunProvider's markOnboardingSeen. */
export function withSpotSeen(run: Pick<RunState, 'onboarding'>, spot: OnboardingSpotId): OnboardingSpotId[] {
  const seen = seenSpots(run)
  return seen.includes(spot) ? seen : [...seen, spot]
}

/** Everything at once, for a GM who already knows the game. Keeps any hint-only spots already
 *  recorded rather than replacing the list, so skipping never *un*-sees something. */
export function withOnboardingSkipped(run: Pick<RunState, 'onboarding'>): OnboardingSpotId[] {
  return [...new Set<OnboardingSpotId>([...seenSpots(run), ...ALL_CHECKLIST_SPOTS])]
}
