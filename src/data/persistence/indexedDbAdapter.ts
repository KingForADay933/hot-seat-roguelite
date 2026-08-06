import type { StorageAdapter } from './storageAdapter'

const DB_NAME = 'hotseat'
const DB_VERSION = 1
const STORE_NAME = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Opened once and reused -- IndexedDB connections are meant to be long-lived, not re-opened per call.
let dbPromise: Promise<IDBDatabase> | null = null
function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb()
  return dbPromise
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * IndexedDB-backed StorageAdapter -- swapped in for the old localStorage-backed one because
 * localStorage's ~5MB per-origin quota (a hard Chromium/Blink limit, unaffected by wrapping the
 * app in Electron, which embeds the same storage engine) is smaller than a single roguelite
 * season's possession-log payload. IndexedDB's quota is disk-based instead, comfortably clearing
 * that. Implements the same async StorageAdapter interface storageAdapter.ts was deliberately
 * shaped for, so every call site (runRepository.ts, repository.ts) needed only an import swap.
 */
export const indexedDbAdapter: StorageAdapter = {
  async getItem(key) {
    const db = await getDb()
    const result = await promisifyRequest<string | undefined>(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key))
    return result ?? null
  },
  async setItem(key, value) {
    const db = await getDb()
    await promisifyRequest(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key))
  },
  async removeItem(key) {
    const db = await getDb()
    await promisifyRequest(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key))
  },
  async clear() {
    const db = await getDb()
    await promisifyRequest(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear())
  },
}
