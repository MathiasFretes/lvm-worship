// One AsyncStorage round trip for the whole splash gate.
//
// The launch path hydrates eleven device-local stores before first paint, and
// between them they read their keys with separate getItem calls (five in
// defaults.ts alone). This module reads those — plus the one non-splash-gating
// key that rides along (see the list below) — in a single multiGet and hands
// back a KVStorage-shaped facade served from the result.
//
// The point of the facade — rather than teaching each store to accept a
// pre-read value — is that parsing and validation logic
// in those stores changes. Nearly every key backs a user preference, and a
// silent behaviour change here would reset people's settings on upgrade.
// Equivalence is established by construction instead of by review.
//
// RN-free (storage is injected, like defaults.ts) so it unit-tests headless.

export type KVStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/** AsyncStorage's shape, narrowed to what this module uses. */
export type BatchKVStorage = KVStorage & {
  multiGet(keys: string[]): Promise<readonly (readonly [string, string | null])[]>
}

/**
 * Every key read inside the splash-gating Promise.all in app/_layout.tsx, in
 * hydration order. Each one is owned by the module listed beside it, which is
 * also where its fallback lives — this list must stay in sync with those reads,
 * but a key MISSING from this list is harmless: the facade simply delegates that
 * getItem to the real store, exactly as today.
 *
 * Deliberately excluded: GoTrue's own session key (read behind the auth
 * navigator lock and bounded by GATE_MS, not by us), the pending sprite (only
 * read on a SIGNED_IN event), and the screen-scoped keys in autoHideChrome.ts and
 * useDailyHighlights.ts, which are not on the launch path.
 */
export const LAUNCH_STORAGE_KEYS = [
  'lvm.defaults.theme',
  'lvm.defaults.chordStyle',
  'lvm.defaults.keepAwake',
  'lvm.defaults.language',
  'lvm.defaults.dailyWordDestination',
  'lvm.downloads.v1', // downloads/manifest.ts   → DEFAULT_DOWNLOADS_STATE
  'lvm.songdrafts.v1',
  'lvm.recents.songs.v1',
  'lvm.readingStreak.v1',
  'lvm.readerReminder.v1', // readerReminder.ts       → DEFAULT_READER_REMINDER
  'lvm.viewer.columns.v2', // viewerPrefs.ts          → DEFAULT_COLUMNS (1)
  'lvm.bible.translation.v1',
  'lvm.reader.settings.v1', // readerSettings.ts       → defaultReaderSettings
  'lvm.reflection.today.v1', // reflectionDayStore.ts   → null (nothing cached)
  'lvm.intro.seen.v1',
  // reviewState.ts → DEFAULT_REVIEW_STATE. The odd one out: it does NOT gate the
  // splash (nothing on screen depends on it, and the review gate cannot fire
  // before the user has navigated somewhere). It rides this batch anyway rather
  // than adding a sixteenth round trip for a key that is read on every launch.
  'lvm.review.v1',
] as const

/**
 * Read `keys` in one batch and return a KVStorage that serves those reads from
 * memory.
 *
 * Behaviour that is deliberately identical to one getItem call per key:
 *
 * - A key absent from storage yields null, which is what every store's
 *   missing-value branch already handles. multiGet reports an absent key as
 *   [key, null], and a pair missing from the response falls to null too.
 * - A REJECTING multiGet returns the raw store untouched, so each module does
 *   its own getItem behind its own try/catch just as it does today. Without
 *   this, one failed batch would reset every batched preference to its default
 *   at once — a far worse failure than the per-module degradation we have now.
 *
 * The facade is a correct KVStorage for the app's whole lifetime, not just for
 * the launch read: the stores keep whatever storage they were handed for
 * write-through (`storage = store` in each hydrate function), so setDefaultTheme
 * will call this object hours later. Writes therefore delegate to the real
 * store, and each primed read is consumed once so any later read goes straight
 * to the real store rather than to a stale snapshot.
 */
export async function primeLaunchStorage(
  store: BatchKVStorage,
  keys: readonly string[] = LAUNCH_STORAGE_KEYS,
): Promise<KVStorage> {
  let primed: Map<string, string | null>
  try {
    const pairs = await store.multiGet([...keys])
    primed = new Map(pairs.map(([key, value]) => [key, value ?? null]))
  } catch {
    return store
  }

  return {
    getItem: async (key) => {
      if (!primed.has(key)) return store.getItem(key)
      const value = primed.get(key) ?? null
      primed.delete(key)
      return value
    },
    setItem: (key, value) => {
      primed.delete(key)
      return store.setItem(key, value)
    },
    removeItem: (key) => {
      primed.delete(key)
      return store.removeItem(key)
    },
  }
}
