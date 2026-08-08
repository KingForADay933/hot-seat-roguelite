import type { AttributeKey, Player } from '../data/types'
import { isPositionless, isSpecialist } from '../engine/positionFit'
import { ATTRIBUTE_COLUMNS } from './attributeColumns'

/**
 * Display-only scouting labels derived from a player's hidden traits and development state. There
 * is no per-player quirk field in the data model -- PlayerHiddenTraits (consistency/clutch/
 * durability/tendency/morale) and PlayerDevelopment (potential, age curve) already *are* the
 * per-player variation, they were just never surfaced anywhere. This file names them so the team
 * reveal can show a GM who they actually inherited, without inventing a parallel system the
 * simulation doesn't read.
 *
 * Positionless/Specialist are the one exception to that last clause: the simulation does read them
 * (engine/positionFit.ts's out-of-position penalty), so their derivation lives there and this file
 * only wraps it for display -- reusing the same vocabulary a rotation chart will eventually show,
 * per rotation-charts.md Section 4's "reconcile the vocabulary" note.
 */
export type TagTone = 'positive' | 'negative' | 'neutral'

export interface PlayerTag {
  label: string
  /** Why the tag fired, and what it means in-game -- shown as the tag's title/tooltip text. */
  detail: string
  tone: TagTone
}

const CLUTCH_HIGH = 78
const CLUTCH_LOW = 32
const CONSISTENCY_HIGH = 80
const CONSISTENCY_LOW = 42
const DURABILITY_HIGH = 80
const DURABILITY_LOW = 42
const MORALE_HIGH = 82
const MORALE_LOW = 40
/** Total attribute points still available below potential, summed across all ten attributes. */
const HEADROOM_UNTAPPED = 110
const HEADROOM_CAPPED = 25

/** Points of growth still available across every attribute -- the roster's "will this get better?"
 *  number, and what Balanced/Low Ceiling crushes down to near nothing. */
export function growthHeadroom(player: Player): number {
  return (Object.keys(player.attributes) as AttributeKey[]).reduce(
    (sum, key) => sum + Math.max(0, player.development.potential[key] - player.attributes[key]),
    0,
  )
}

/** Highest and lowest attribute by value, as display labels -- the one-glance "what is he" read. */
export function attributeExtremes(player: Player): { best: { label: string; value: number }; worst: { label: string; value: number } } {
  const scored = ATTRIBUTE_COLUMNS.map((col) => ({ label: col.label, value: player.attributes[col.key] }))
  const best = scored.reduce((top, cur) => (cur.value > top.value ? cur : top))
  const worst = scored.reduce((low, cur) => (cur.value < low.value ? cur : low))
  return { best, worst }
}

export function playerTags(player: Player): PlayerTag[] {
  const tags: PlayerTag[] = []
  const { clutch, consistency, durability, morale, tendency } = player.hidden

  if (clutch >= CLUTCH_HIGH) tags.push({ label: 'Ice in the Veins', detail: `Clutch ${clutch} -- shoots better once the game tightens up.`, tone: 'positive' })
  else if (clutch <= CLUTCH_LOW) tags.push({ label: 'Shrinks Late', detail: `Clutch ${clutch} -- falls off in crunch time.`, tone: 'negative' })

  if (consistency >= CONSISTENCY_HIGH) tags.push({ label: 'Metronome', detail: `Consistency ${consistency} -- little night-to-night variance.`, tone: 'positive' })
  else if (consistency <= CONSISTENCY_LOW) tags.push({ label: 'Streaky', detail: `Consistency ${consistency} -- wild swings game to game.`, tone: 'negative' })

  if (durability >= DURABILITY_HIGH) tags.push({ label: 'Iron Man', detail: `Durability ${durability} -- tires slowly, recovers fast on the bench.`, tone: 'positive' })
  else if (durability <= DURABILITY_LOW) tags.push({ label: 'Gasses Out', detail: `Durability ${durability} -- fatigues quickly, needs short shifts.`, tone: 'negative' })

  if (morale >= MORALE_HIGH) tags.push({ label: 'Bought In', detail: `Morale ${morale}.`, tone: 'positive' })
  else if (morale <= MORALE_LOW) tags.push({ label: 'Discontent', detail: `Morale ${morale}.`, tone: 'negative' })

  if (tendency === 'shoot-first') tags.push({ label: 'Shoot-First', detail: 'Hunts his own shot -- takes tougher isolation looks.', tone: 'neutral' })
  else if (tendency === 'pass-first') tags.push({ label: 'Pass-First', detail: 'Gives it up -- passes out of isolation looks.', tone: 'neutral' })

  if (player.development.ageCurveStage === 'rising') tags.push({ label: 'Rising', detail: `Age ${player.age} -- still on the way up.`, tone: 'positive' })
  else if (player.development.ageCurveStage === 'declining')
    tags.push({ label: 'Declining', detail: `Age ${player.age} -- past his peak, attributes erode each season.`, tone: 'negative' })

  const headroom = growthHeadroom(player)
  if (headroom >= HEADROOM_UNTAPPED) tags.push({ label: 'Untapped', detail: `${headroom} attribute points of room below his potential.`, tone: 'positive' })
  else if (headroom <= HEADROOM_CAPPED) tags.push({ label: 'Maxed Out', detail: `Only ${headroom} points of growth left in him.`, tone: 'negative' })

  if (isPositionless(player))
    tags.push({ label: 'Positionless', detail: 'Height and skill set fit more than one slot -- takes less of a hit charted out of position.', tone: 'positive' })
  else if (isSpecialist(player))
    tags.push({ label: 'Specialist', detail: 'Built for one slot -- takes more of a hit charted anywhere else.', tone: 'neutral' })

  return tags
}
