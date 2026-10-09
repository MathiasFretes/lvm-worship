import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetViewerPrefsForTest,
  getColumns,
  hydrateViewerPrefs,
  setColumns,
} from '../viewerPrefs'
import type { KVStorage as KV } from '../defaults'

const KEY = 'lvm.viewer.columns.v2'

function memoryStorage(initial: Record<string, string> = {}): KV & { store: Map<string, string> } {
  const store = new Map(Object.entries(initial))
  return {
    store,
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => void store.set(k, v),
    removeItem: async (k) => void store.delete(k),
  }
}

// Writes are fire-and-forget; let the microtask queue drain before asserting
// on the backing store.
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

beforeEach(() => {
  __resetViewerPrefsForTest()
})

describe.each([{ product: 'LVM' }])('$product · viewerPrefs column ceiling', () => {
  it('defaults to a single column when nothing is stored', async () => {
    await hydrateViewerPrefs(memoryStorage())
    expect(getColumns()).toBe(1)
  })

  it('is GLOBAL — one value, not per song', async () => {
    const s = memoryStorage()
    await hydrateViewerPrefs(s)
    setColumns(3)
    // No slug anywhere in the API: every song in every setlist reads the same
    // value, which is the whole point of v2.
    expect(getColumns()).toBe(3)
  })

  it('persists across a relaunch', async () => {
    const s = memoryStorage()
    await hydrateViewerPrefs(s)
    setColumns(2)
    await flush()

    await hydrateViewerPrefs(memoryStorage()) // fresh empty hydrate = other device
    expect(getColumns()).toBe(1)

    await hydrateViewerPrefs(s) // reload from the original storage
    expect(getColumns()).toBe(2)
  })

  it('drops the stored key when set back to the default', async () => {
    const s = memoryStorage()
    await hydrateViewerPrefs(s)
    setColumns(3)
    await flush()
    expect(s.store.has(KEY)).toBe(true)

    setColumns(1)
    await flush()
    expect(s.store.has(KEY)).toBe(false)
    expect(getColumns()).toBe(1)
  })

  it('survives a corrupt or unknown payload', async () => {
    await hydrateViewerPrefs(memoryStorage({ [KEY]: '{ not json' }))
    expect(getColumns()).toBe(1)

    __resetViewerPrefsForTest()
    await hydrateViewerPrefs(memoryStorage({ [KEY]: JSON.stringify({ columns: 7 }) }))
    expect(getColumns()).toBe(1)
  })
})
