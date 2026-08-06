/**
 * Async-shaped so the concrete backend can vary without touching call sites -- proven out when
 * indexedDbAdapter.ts replaced the original (sync-under-the-hood) localStorage implementation
 * after a season's possession-log payload started exceeding localStorage's ~5MB per-origin quota.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
}
