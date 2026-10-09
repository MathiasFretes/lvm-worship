import { beforeEach, describe, expect, it } from 'vitest'
import type { KVStorage } from '../defaults'
import {
  __resetSyncStateForTest,
  hydrateSyncState,
  putSyncState,
  syncStateSnapshot,
} from '../devotionals/syncState'

const KEY = 'lvm.devotionals.sync.v1'

function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed))
  const store: KVStorage & { data: Map<string, string> } = {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  }
  return store
}

describe('devotional sync state storage', () => {
  beforeEach(() => __resetSyncStateForTest())

  it('starts empty when the LVM key is absent', async () => {
    await hydrateSyncState(memoryStorage())
    expect(syncStateSnapshot()).toEqual({ lastCheckedAt: 0, hashes: {} })
  })

  it('reads and writes the lvm namespace', async () => {
    const store = memoryStorage({
      [KEY]: JSON.stringify({ lastCheckedAt: 12, hashes: { '01': 'new' } }),
    })
    await hydrateSyncState(store)
    expect(syncStateSnapshot()).toEqual({ lastCheckedAt: 12, hashes: { '01': 'new' } })

    putSyncState({ lastCheckedAt: 20, hashes: { '02': 'saved' } })
    expect(JSON.parse(store.data.get(KEY) ?? '{}')).toEqual({
      lastCheckedAt: 20,
      hashes: { '02': 'saved' },
    })
  })

  it('recovers from corrupt storage with an empty state', async () => {
    const store = memoryStorage({ [KEY]: '{broken' })
    await expect(hydrateSyncState(store)).resolves.toEqual({ lastCheckedAt: 0, hashes: {} })
  })
})
