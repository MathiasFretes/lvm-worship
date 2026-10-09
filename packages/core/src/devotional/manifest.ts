// Manifest parsing and sync planning. Pure functions over plain data — no I/O,
// no fetch, no storage. The caller does the network and disk work; this module
// only decides what is worth doing.

import type { Manifest, ManifestMonth, MonthFile, SyncState } from './types'

/** Devotional artifact schema this build understands. */
export const DEVOTIONAL_SCHEMA = 1

/** How often the device bothers checking the manifest. Once a day is plenty. */
export const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000

const MONTH_KEYS = Object.freeze(
  Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')),
)

/** Every valid month key, `"01"`–`"12"`. */
export function monthKeys(): string[] {
  return [...MONTH_KEYS]
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v)

function parseManifestMonth(value: unknown): ManifestMonth | null {
  if (!isObj(value)) return null
  const file = typeof value.file === 'string' ? value.file : ''
  const hash = typeof value.hash === 'string' ? value.hash : ''
  if (!file || !hash) return null
  const bytes = Number(value.bytes)
  return { file, hash, bytes: Number.isFinite(bytes) ? bytes : 0 }
}

/**
 * Validate an untrusted manifest payload.
 *
 * Returns null rather than throwing: a malformed manifest is a silent no-op
 * (the device keeps whatever it already has), never a crash. A future schema is
 * also rejected — an artifact this build cannot read is worse than a stale one
 * it can.
 */
export function parseManifest(payload: unknown): Manifest | null {
  if (!isObj(payload)) return null
  const schemaVersion = Number(payload.schemaVersion)
  if (!Number.isFinite(schemaVersion) || schemaVersion !== DEVOTIONAL_SCHEMA) return null
  if (!isObj(payload.months)) return null
  const contentVersion = typeof payload.contentVersion === 'string' ? payload.contentVersion : ''
  if (!contentVersion) return null

  const rawMonths = payload.months
  const months = Object.fromEntries(
    MONTH_KEYS.flatMap((key) => {
      const month = parseManifestMonth(rawMonths[key])
      return month ? [[key, month]] : []
    }),
  ) as Record<string, ManifestMonth>
  if (!Object.keys(months).length) return null
  return {
    schemaVersion,
    contentVersion,
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : null,
    months,
  }
}

/** Validate an untrusted month payload. Returns null on anything unexpected. */
export function parseMonthFile(payload: unknown): MonthFile | null {
  if (!isObj(payload)) return null
  const month = Number(payload.month)
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  if (!isObj(payload.days)) return null
  const schemaVersion = Number(payload.schemaVersion)
  if (schemaVersion !== DEVOTIONAL_SCHEMA) return null
  return { month, schemaVersion, days: payload.days as MonthFile['days'] }
}

export function emptySyncState(): SyncState {
  return { lastCheckedAt: 0, hashes: {} }
}

/** Validate persisted sync state, falling back to empty. */
export function parseSyncState(payload: unknown): SyncState {
  if (!isObj(payload)) return emptySyncState()
  const lastCheckedAt = Number(payload.lastCheckedAt)
  const source = isObj(payload.hashes) ? payload.hashes : {}
  const hashes = Object.fromEntries(
    MONTH_KEYS.flatMap((key) => {
      const hash = source[key]
      return typeof hash === 'string' && hash ? [[key, hash]] : []
    }),
  )
  return { lastCheckedAt: Number.isFinite(lastCheckedAt) ? lastCheckedAt : 0, hashes }
}

/** Whether enough time has passed to justify a manifest check. */
export function shouldCheck(state: SyncState, now: number): boolean {
  if (!Number.isFinite(now)) return false
  // A clock that moved backwards (timezone change, manual set) should not lock
  // sync out until it catches up.
  if (state.lastCheckedAt > now) return true
  return now - state.lastCheckedAt >= SYNC_INTERVAL_MS
}

/**
 * Which months changed and are worth fetching, in stable month order.
 *
 * A month is stale when the manifest's hash differs from the cached hash — the
 * comparison is by content, not by version number or date, so a rebuild that
 * changes nothing costs no downloads.
 */
export function staleMonths(manifest: Manifest, state: SyncState): string[] {
  return MONTH_KEYS.filter(
    (key) => manifest.months[key] && state.hashes[key] !== manifest.months[key].hash,
  )
}

/** Record a month as cached at the given hash. Returns a new state. */
export function withCachedMonth(state: SyncState, month: string, hash: string): SyncState {
  return { ...state, hashes: { ...state.hashes, [month]: hash } }
}

/** Record the time of a completed manifest check. Returns a new state. */
export function withCheckedAt(state: SyncState, now: number): SyncState {
  return { ...state, lastCheckedAt: now }
}
