import type { Rng } from '../../engine/rng'

/** Fisher-Yates shuffle then take the front `count` -- shared by every "roll N distinct candidates
 *  for a draft" call site (roster quirks, house rules, and system draft once it lands). */
export function pickDistinct<T>(pool: T[], count: number, rng: Rng): T[] {
  if (count > pool.length) throw new Error(`Cannot pick ${count} distinct items from a pool of ${pool.length}`)

  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}
