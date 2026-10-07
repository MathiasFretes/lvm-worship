import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetDownloadsForTest,
  DEFAULT_DOWNLOADS_STATE,
  getDownload,
  getDownloadsSnapshot,
  hydrateDownloads,
  isDownloaded,
  removeDownload,
  setWifiOnly,
  upsertDownload,
} from '../manifest'
import type { BibleDownload } from '../types'
import { memoryStorage } from './helpers'

const recA: BibleDownload = {
  id: 'esv',
  type: 'bible',
  dataRoot: 'bible/en/esv',
  label: 'ESV',
  name: 'English Standard Version',
  language: 'English',
  version: 'v1',
  sizeBytes: 1234,
  chapterCount: 1189,
  downloadedAt: '2026-07-02T00:00:00.000Z',
  status: 'complete',
}

describe('downloads manifest', () => {
  beforeEach(() => __resetDownloadsForTest())

  it('is empty before anything is recorded', async () => {
    await hydrateDownloads(memoryStorage())
    expect(getDownloadsSnapshot().records).toEqual({})
    expect(getDownloadsSnapshot().wifiOnly).toBe(false)
    expect(isDownloaded('esv')).toBe(false)
  })

  it('records, reads back, and removes a download', async () => {
    await hydrateDownloads(memoryStorage())
    upsertDownload(recA)
    expect(isDownloaded('esv')).toBe(true)
    expect(getDownload('esv')).toEqual(recA)

    // "mark stale" = a re-download overwrites with a new version.
    upsertDownload({ ...recA, version: 'v2' })
    expect(getDownload('esv')?.version).toBe('v2')

    const removed = removeDownload('esv')
    expect(removed?.id).toBe('esv')
    expect(isDownloaded('esv')).toBe(false)
    expect(getDownloadsSnapshot().records).toEqual({})
  })

  it('survives a simulated reload (re-hydrate from the same storage)', async () => {
    const s = memoryStorage()
    await hydrateDownloads(s)
    upsertDownload(recA)
    setWifiOnly(true)

    // Reset the module cache, prove a fresh empty store yields nothing...
    __resetDownloadsForTest()
    await hydrateDownloads(memoryStorage())
    expect(getDownloadsSnapshot().records).toEqual({})
    expect(getDownloadsSnapshot().wifiOnly).toBe(false)

    // ...then reload from the persisted store and confirm state came back.
    await hydrateDownloads(s)
    expect(getDownload('esv')).toEqual(recA)
    expect(getDownloadsSnapshot().wifiOnly).toBe(true)
  })

  it('ignores malformed persisted state', async () => {
    await hydrateDownloads(memoryStorage({ 'lvm.downloads.v1': '{ not json' }))
    expect(getDownloadsSnapshot().records).toEqual({})
  })

  it('rejects incomplete records and records whose map key disagrees with their id', async () => {
    const incomplete = { ...recA, chapterCount: 0 }
    const mismatched = { ...recA, id: 'niv' }
    const raw = JSON.stringify({
      records: { incomplete, esv: mismatched },
      wifiOnly: true,
    })

    await hydrateDownloads(memoryStorage({ 'lvm.downloads.v1': raw }))

    expect(getDownloadsSnapshot()).toEqual({ records: {}, wifiOnly: true })
  })

  it('persists rapid changes in order even when an older write is slow', async () => {
    const persisted = new Map<string, string>()
    let releaseFirstWrite!: () => void
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve
    })
    let writes = 0
    const store = {
      getItem: async (key: string) => persisted.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        writes++
        if (writes === 1) await firstWriteGate
        persisted.set(key, value)
      },
      removeItem: async (key: string) => void persisted.delete(key),
    }

    await hydrateDownloads(store)
    upsertDownload(recA)
    // Let the first write start, then queue the removal behind it.
    await Promise.resolve()
    removeDownload(recA.id)
    releaseFirstWrite()

    // Rehydration waits for all same-process writes before reading.
    await hydrateDownloads(store)
    expect(getDownloadsSnapshot().records).toEqual({})
    expect(writes).toBe(2)
  })

  it('does not let a slow hydration overwrite a newer in-memory change', async () => {
    let releaseRead!: (value: string | null) => void
    const pendingRead = new Promise<string | null>((resolve) => {
      releaseRead = resolve
    })
    let readStarted!: () => void
    const started = new Promise<void>((resolve) => {
      readStarted = resolve
    })
    const store = {
      getItem: async () => {
        readStarted()
        return pendingRead
      },
      setItem: async () => {},
      removeItem: async () => {},
    }

    const hydration = hydrateDownloads(store)
    await started
    setWifiOnly(true)
    releaseRead(JSON.stringify(DEFAULT_DOWNLOADS_STATE))
    await hydration

    expect(getDownloadsSnapshot().wifiOnly).toBe(true)
  })
})
