import type { StorageAdapter } from './storageAdapter'

export const localStorageAdapter: StorageAdapter = {
  async getItem(key) {
    return window.localStorage.getItem(key)
  },
  async setItem(key, value) {
    window.localStorage.setItem(key, value)
  },
  async removeItem(key) {
    window.localStorage.removeItem(key)
  },
  async clear() {
    window.localStorage.clear()
  },
}
