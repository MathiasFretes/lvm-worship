import { createOfflineSetlists } from '@lavozmisionera/core/setlists/offlineSetlists'

const DATABASE = 'lvm-rehearsal-downloads'
const STORE = 'accounts'

// Downloads are explicitly stored content, separate from the API and HTTP caches.
export function createBrowserOfflineSetlists(factory = globalThis.indexedDB) {
  function open() {
    return new Promise((resolve, reject) => {
      if (!factory) return reject(new Error('Offline storage is unavailable'))
      const request = factory.open(DATABASE, 1)
      let abandoned = false
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => {
        abandoned = true
        reject(new Error('Close other LVM tabs to update offline storage'))
      }
      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => database.close()
        if (abandoned) database.close()
        else resolve(database)
      }
    })
  }

  async function transaction(ownerId, change) {
    const database = await open()
    try {
      return await new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, change ? 'readwrite' : 'readonly')
        const store = tx.objectStore(STORE)
        const request = store.get(ownerId)
        let value = null
        let failure
        request.onsuccess = () => {
          try {
            value = request.result ?? null
            if (change) store.put(change(value), ownerId)
          } catch (error) {
            failure = error
            tx.abort()
          }
        }
        tx.oncomplete = () => resolve(value)
        tx.onabort = () => reject(failure ?? tx.error ?? new Error('Offline storage transaction aborted'))
        tx.onerror = () => { /* onabort reports the transaction failure. */ }
      })
    } finally {
      database.close()
    }
  }

  return createOfflineSetlists({
    read: ownerId => transaction(ownerId),
    write: (ownerId, raw) => transaction(ownerId, () => raw),
    update: (ownerId, change) => transaction(ownerId, change),
  })
}
