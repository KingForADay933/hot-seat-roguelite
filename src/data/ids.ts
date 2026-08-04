let counter = 0

/** Simple prefixed, monotonically-unique id — no need for real UUIDs at MVP scale. */
export function createId(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`
}
