import { useSyncExternalStore } from 'react'
import type { KVStorage } from './defaults'
import type { ColumnCount } from './columnCapacity'

// Viewer preferences — today just the column ceiling (how many chart columns
// the layout planner may use). Device-local (AsyncStorage), NOT Supabase-synced.
//
// GLOBAL, not per-song: one setting covers the Song Viewer and every song in a
// setlist play-through. An earlier version keyed this per song slug, which made
// the choice silently reset song-to-song mid-set; v2 drops those overrides.
//
// The stored value is a CEILING. columnCapacity caps it again by device/width,
// and columnLayout may use fewer columns still when fewer give larger text.
//
// Follows the defaults.ts pattern: storage is INJECTED so the module is RN-free
// and unit-testable headless; the app root hydrates once during the splash
// hold, after which reads are synchronous.

export const DEFAULT_COLUMNS: ColumnCount = 1

const STORAGE_KEY = 'lvm.viewer.columns.v2'

let columns: ColumnCount = DEFAULT_COLUMNS
let storage: KVStorage | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function isColumnCount(v: unknown): v is ColumnCount {
  return v === 1 || v === 2 || v === 3
}

function parse(raw: string | null): ColumnCount {
  if (!raw) return DEFAULT_COLUMNS
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return DEFAULT_COLUMNS
    const value = (parsed as Record<string, unknown>).columns
    return isColumnCount(value) ? value : DEFAULT_COLUMNS
  } catch {
    return DEFAULT_COLUMNS
  }
}

function persist(): void {
  if (!storage) return
  if (columns === DEFAULT_COLUMNS) {
    storage.removeItem(STORAGE_KEY).catch(() => {})
    return
  }
  storage.setItem(STORAGE_KEY, JSON.stringify({ columns })).catch(() => {})
}

/**
 * Load stored prefs into the cache and remember `store` for write-through.
 * A bad read never crashes the app. Safe to call again to re-read from the same
 * storage (used to simulate a reload in tests).
 */
export async function hydrateViewerPrefs(store: KVStorage): Promise<void> {
  storage = store
  try {
    columns = parse(await store.getItem(STORAGE_KEY))
  } catch {
    columns = DEFAULT_COLUMNS
  }
  emit()
}

/** The user's column ceiling. Cap it with columnCapacity before using it. */
export function getColumns(): ColumnCount {
  return columns
}

export function setColumns(next: ColumnCount): void {
  if (columns === next) return
  columns = next
  emit()
  persist()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Subscribing hook — the column ceiling, re-rendering on change. */
export function useColumns(): ColumnCount {
  return useSyncExternalStore(subscribe, getColumns, getColumns)
}

/** Test-only reset so each test starts from a clean module state. */
export function __resetViewerPrefsForTest(): void {
  columns = DEFAULT_COLUMNS
  storage = null
}
