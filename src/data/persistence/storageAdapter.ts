/**
 * Async-shaped even though the MVP's localStorage implementation is synchronous under the hood,
 * so swapping to IndexedDB later (once saved-games/multi-season retention needs it) is a drop-in
 * replacement with zero call-site changes.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
}
