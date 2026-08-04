import type { PlayCallType } from '../../data/types'

export type ActionPhraseBuilder = (primary: string, secondary?: string) => string
export type OutcomePhraseBuilder = (primary: string) => string

export type OutcomeKey = 'make2' | 'make3' | 'miss2' | 'miss3' | 'turnover' | 'foul'

/** How the possession's action unfolded, per play call. Pick-and-Roll/Spot-Up/Cutting/Transition
 *  use `secondary` (the roller/creator/passer/outlet); Isolation/Post-Up don't have one. */
export const ACTION_PHRASES: Record<PlayCallType, ActionPhraseBuilder[]> = {
  'pick-and-roll': [
    (p, s) => `${p} runs a pick-and-roll with ${s}`,
    (p, s) => `${p} comes off a high screen from ${s}`,
    (p, s) => `${p} works the two-man game, looking for ${s} on the roll`,
  ],
  isolation: [
    (p) => `${p} goes to work one-on-one`,
    (p) => `${p} isolates on the wing`,
    (p) => `${p} takes their defender off the dribble`,
  ],
  'post-up': [
    (p) => `${p} backs it down in the post`,
    (p) => `${p} works for deep position on the block`,
    (p) => `${p} bullies their way into the paint`,
  ],
  'spot-up': [
    (p, s) => `${s} kicks it out to ${p} in the corner`,
    (p, s) => `${s} finds ${p} open on the perimeter`,
    (p, s) => `${p} spots up after a pass from ${s}`,
  ],
  cutting: [
    (p, s) => `${p} cuts backdoor and ${s} finds them`,
    (p, s) => `${s} hits ${p} slashing through the lane`,
    (p, s) => `${p} slips behind the defense off a feed from ${s}`,
  ],
  transition: [
    (p) => `${p} pushes it hard in transition`,
    (p, s) => `${s} grabs the board and outlets ahead to ${p}`,
    (p) => `${p} races up the floor on the break`,
  ],
}

/** What happened at the end of the action -- keyed by outcome + shot type (miss/make split by
 *  points, since a plain 'outcome' field alone can't distinguish a 2 from a 3 -- see
 *  PossessionLogEntry.isThreePointAttempt's own doc comment for the same reasoning). */
export const OUTCOME_PHRASES: Record<OutcomeKey, OutcomePhraseBuilder[]> = {
  make2: [(p) => `${p} scores!`, (p) => `${p} finishes strong at the rim!`, () => 'And it is good inside!'],
  make3: [(p) => `${p} buries the three!`, () => 'Bang, it is good from deep!', (p) => `${p} splashes it from downtown!`],
  miss2: [() => 'But the shot rims out.', (p) => `${p} can't connect inside.`, () => 'No good at the rim.'],
  miss3: [
    () => 'But it is off the mark from deep.',
    (p) => `${p} can't find the range from three.`,
    () => 'The three-point attempt is no good.',
  ],
  turnover: [
    (p) => `But ${p} loses the handle -- turnover!`,
    () => 'The pass is picked off -- turnover!',
    (p) => `${p} throws it away.`,
  ],
  foul: [(p) => `${p} draws a foul on the play.`, () => 'And a whistle blows -- foul.', (p) => `${p} gets fouled going up.`],
}
