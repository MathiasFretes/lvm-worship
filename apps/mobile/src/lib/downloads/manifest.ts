import { useSyncExternalStore } from 'react'
import type { BibleDownload, KVStorage } from './types'

// Device-local download manifest — which Bible translations are on this device,
// plus the "Wi-Fi only" preference. Follows the defaults.ts pattern exactly:
// storage is INJECTED (a KVStorage), hydrated once at splash, then read
// synchronously via a stable-reference snapshot so screens seed state with no
// flash and useSyncExternalStore stays correct. Device-local, NOT Supabase-synced.

export type DownloadsState = {
  /** Completed downloads keyed by translation id. */
  records: Record<string, BibleDownload>
  /** "Download over Wi-Fi only" preference. */
  wifiOnly: boolean
}

export const DEFAULT_DOWNLOADS_STATE: DownloadsState = {
  records: {},
  wifiOnly: false,
}

const STORAGE_KEY = 'lvm.downloads.v1'

// Replaced with a NEW object on every change so getSnapshot returns a stable
// reference between changes (required — it must not build a fresh object each call).
let cache: DownloadsState = DEFAULT_DOWNLOADS_STATE
let storage: KVStorage | null = null
const listeners = new Set<() => void>()
// AsyncStorage writes are not transactional. Keep them in invocation order so
// a slow older write can never land after a newer remove/toggle and resurrect
// stale state on the next launch.
let persistTail: Promise<void> = Promise.resolve()
// A hydrate may be waiting on storage while the screen changes a preference or
// records a completed download. Track in-memory mutations so that stale read
// results cannot overwrite those newer changes.
let mutationRevision = 0

function emit() {
  for (const l of listeners) l()
}

function persist() {
  const target = storage
  if (!target) return
  const serialized = JSON.stringify(cache)
  const write = persistTail.then(() => target.setItem(STORAGE_KEY, serialized))
  // Swallow a failed write for the existing best-effort semantics, but keep the
  // chain usable so later state still gets a chance to persist.
  persistTail = write.catch(() => {})
}

function isBibleDownload(v: unknown): v is BibleDownload {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    r.type === 'bible' &&
    typeof r.dataRoot === 'string' &&
    r.dataRoot.length > 0 &&
    typeof r.label === 'string' &&
    typeof r.name === 'string' &&
    typeof r.language === 'string' &&
    typeof r.version === 'string' &&
    typeof r.sizeBytes === 'number' &&
    Number.isFinite(r.sizeBytes) &&
    r.sizeBytes >= 0 &&
    typeof r.chapterCount === 'number' &&
    Number.isInteger(r.chapterCount) &&
    r.chapterCount > 0 &&
    typeof r.downloadedAt === 'string' &&
    !Number.isNaN(Date.parse(r.downloadedAt)) &&
    r.status === 'complete'
  )
}

function parseState(raw: string | null): DownloadsState {
  if (!raw) return DEFAULT_DOWNLOADS_STATE
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return DEFAULT_DOWNLOADS_STATE
    const obj = parsed as Record<string, unknown>
    const records: Record<string, BibleDownload> = {}
    const rawRecords = obj.records
    if (rawRecords && typeof rawRecords === 'object') {
      for (const [id, value] of Object.entries(rawRecords as Record<string, unknown>)) {
        // The map key is the lookup/delete authority. Reject a mismatched
        // embedded id instead of making one translation operate on another's
        // record.
        if (isBibleDownload(value) && value.id === id) records[id] = value
      }
    }
    return { records, wifiOnly: obj.wifiOnly === true }
  } catch {
    return DEFAULT_DOWNLOADS_STATE
  }
}

/**
 * Load the manifest into the cache and remember `store` for write-through. A bad
 * read never crashes the app — it falls back to the empty state. Safe to call
 * again to re-read from the same storage (used to simulate a reload in tests).
 */
export async function hydrateDownloads(store: KVStorage): Promise<DownloadsState> {
  storage = store
  // Finish writes requested before a same-process rehydrate (tests, fast root
  // remounts) before reading them back.
  await persistTail
  const revisionAtReadStart = mutationRevision
  let next = DEFAULT_DOWNLOADS_STATE
  try {
    next = parseState(await store.getItem(STORAGE_KEY))
  } catch {
    // best-effort — fall back to the empty state
  }
  // A newer screen action wins over the storage snapshot that was in flight.
  if (mutationRevision !== revisionAtReadStart) return cache
  cache = next
  emit()
  return cache
}

/** Synchronous read of the current manifest (safe before hydrate — empty state). */
export function getDownloadsSnapshot(): DownloadsState {
  return cache
}

/** Record (or replace) a completed download and persist. */
export function upsertDownload(record: BibleDownload): void {
  cache = { ...cache, records: { ...cache.records, [record.id]: record } }
  mutationRevision++
  emit()
  persist()
}

/** Remove a download from the manifest and persist. Returns the removed record, if any. */
export function removeDownload(id: string): BibleDownload | null {
  const existing = cache.records[id]
  if (!existing) return null
  const nextRecords = { ...cache.records }
  delete nextRecords[id]
  cache = { ...cache, records: nextRecords }
  mutationRevision++
  emit()
  persist()
  return existing
}

/** Look up a single record (undefined when not downloaded). */
export function getDownload(id: string): BibleDownload | undefined {
  return cache.records[id]
}

export function isDownloaded(id: string): boolean {
  return Boolean(cache.records[id])
}

export function setWifiOnly(value: boolean): void {
  if (cache.wifiOnly === value) return
  cache = { ...cache, wifiOnly: value }
  mutationRevision++
  emit()
  persist()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Subscribing hook — re-renders the Offline screen on any manifest change. */
export function useDownloads(): DownloadsState {
  return useSyncExternalStore(subscribe, getDownloadsSnapshot, getDownloadsSnapshot)
}

/** Test-only reset so each test starts from a clean module state. */
export function __resetDownloadsForTest(): void {
  cache = DEFAULT_DOWNLOADS_STATE
  storage = null
  mutationRevision = 0
  listeners.clear()
}
