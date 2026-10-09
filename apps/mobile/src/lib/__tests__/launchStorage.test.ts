import { describe, expect, it, vi } from 'vitest'
import { LAUNCH_STORAGE_KEYS, primeLaunchStorage, type BatchKVStorage } from '../launchStorage'
import { DEFAULT_APP_DEFAULTS, hydrateDefaults } from '../defaults'
import { hydrateBibleTranslationPref, getBibleTranslationPref } from '../bibleTranslationPref'
import { hydrateRecents, getRecentlyOpened } from '../recents'
import { hydrateReadingStreak, getReadingStreak, DEFAULT_READING_STREAK } from '../readingStreak'
import { hydrateReaderReminder, getReaderReminder, DEFAULT_READER_REMINDER } from '../readerReminder'
import { DEFAULT_COLUMNS, getColumns, hydrateViewerPrefs } from '../viewerPrefs'
import {
  __resetReaderSettingsForTest,
  defaultReaderSettings,
  getReaderSettings,
  hydrateReaderSettings,
} from '../readerSettings'
import {
  __resetReflectionDayStoreForTest,
  getReflectionDay,
  hydrateTodayReflection,
  reflectionCacheKey,
} from '../reflectionDayStore'

// Assert the outcome each module produces when fed through a batch, not only
// the facade in isolation.

/** Fixed "now" so the reflection cases don't depend on the day they run. */
const REFLECTION_NOW = new Date('2026-08-07T12:00:00')

function makeStore(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed))
  const store: BatchKVStorage & { multiGetCalls: number; getItemCalls: string[] } = {
    multiGetCalls: 0,
    getItemCalls: [],
    async multiGet(keys) {
      store.multiGetCalls += 1
      return keys.map((key) => [key, data.has(key) ? (data.get(key) as string) : null] as const)
    },
    async getItem(key) {
      store.getItemCalls.push(key)
      return data.has(key) ? (data.get(key) as string) : null
    },
    async setItem(key, value) {
      data.set(key, value)
    },
    async removeItem(key) {
      data.delete(key)
    },
  }
  return { store, data }
}

describe.each([{ product: 'LVM' }])('$product · LAUNCH_STORAGE_KEYS', () => {
  it('covers the LVM keys read at launch without duplicates', () => {
    expect(LAUNCH_STORAGE_KEYS).toHaveLength(16)
    expect(new Set(LAUNCH_STORAGE_KEYS).size).toBe(16)
    expect(LAUNCH_STORAGE_KEYS.every((key) => key.startsWith('lvm.'))).toBe(true)
  })
})

describe.each([{ product: 'LVM' }])('$product · primeLaunchStorage', () => {
  it('reads every key in ONE multiGet and serves hydration from it', async () => {
    const { store } = makeStore()
    const primed = await primeLaunchStorage(store)
    await Promise.all(LAUNCH_STORAGE_KEYS.map((key) => primed.getItem(key)))
    expect(store.multiGetCalls).toBe(1)
    expect(store.getItemCalls).toEqual([])
  })

  it('delegates a key outside the batch to the real store', async () => {
    const { store } = makeStore({ 'lvm.viewer.autoHideChrome': '1' })
    const primed = await primeLaunchStorage(store)
    await expect(primed.getItem('lvm.viewer.autoHideChrome')).resolves.toBe('1')
    expect(store.getItemCalls).toEqual(['lvm.viewer.autoHideChrome'])
  })

  it('falls back to the real store when multiGet rejects', async () => {
    // Today each module does its own getItem behind its own try/catch, so one
    // failing read can only affect one module. A batch that reset every batched
    // preference to its default at once would be a far worse failure.
    const { store } = makeStore({ 'lvm.defaults.theme': 'dark' })
    store.multiGet = () => Promise.reject(new Error('storage unavailable'))
    const primed = await primeLaunchStorage(store)
    expect(primed).toBe(store)
    await expect(hydrateDefaults(primed)).resolves.toMatchObject({ theme: 'dark' })
  })

  it('serves viewerPrefs entirely from the batch (no fall-through)', async () => {
    const { store } = makeStore({ 'lvm.viewer.columns.v2': JSON.stringify({ columns: 2 }) })
    const primed = await primeLaunchStorage(store)
    await hydrateViewerPrefs(primed)
    expect(getColumns()).toBe(2)
    expect(store.getItemCalls).toEqual([])
  })

  it('serves a primed key once, then defers to the real store', async () => {
    // The hydrate modules keep whatever storage they were handed for
    // write-through, for the app's whole lifetime — so the facade must stay
    // correct long after launch, never answering from a stale snapshot.
    const { store, data } = makeStore({ 'lvm.defaults.theme': 'dark' })
    const primed = await primeLaunchStorage(store)
    await expect(primed.getItem('lvm.defaults.theme')).resolves.toBe('dark')
    data.set('lvm.defaults.theme', 'light')
    await expect(primed.getItem('lvm.defaults.theme')).resolves.toBe('light')
  })

  it('writes through, and a later read sees the written value', async () => {
    const { store, data } = makeStore({ 'lvm.defaults.theme': 'dark' })
    const primed = await primeLaunchStorage(store)
    await primed.setItem('lvm.defaults.theme', 'light')
    expect(data.get('lvm.defaults.theme')).toBe('light')
    await expect(primed.getItem('lvm.defaults.theme')).resolves.toBe('light')
  })

  it('removes through, and a later read sees the removal', async () => {
    const { store, data } = makeStore({ 'lvm.defaults.language': 'ko' })
    const primed = await primeLaunchStorage(store)
    await primed.removeItem('lvm.defaults.language')
    expect(data.has('lvm.defaults.language')).toBe(false)
    await expect(primed.getItem('lvm.defaults.language')).resolves.toBeNull()
  })

  it('treats a pair missing from the multiGet response as null', async () => {
    const { store } = makeStore()
    store.multiGet = async () => [['lvm.defaults.theme', 'dark'] as const]
    const primed = await primeLaunchStorage(store)
    await expect(primed.getItem('lvm.defaults.theme')).resolves.toBe('dark')
    // Not in the response at all — must read exactly like an absent key, which
    // is what every module's missing-value branch already handles.
    await expect(primed.getItem('lvm.defaults.chordStyle')).resolves.toBeNull()
  })
})

describe.each([{ product: 'LVM' }])('$product · fallbacks are unchanged, batched vs unbatched', () => {
  // Each case runs the SAME module twice — once against the raw store, once
  // against the primed facade — and requires identical results.
  const cases: Array<{
    name: string
    seed: Record<string, string>
    run: (store: BatchKVStorage | Awaited<ReturnType<typeof primeLaunchStorage>>) => Promise<unknown>
  }> = [
    {
      name: 'defaults: all keys absent',
      seed: {},
      run: async (s) => hydrateDefaults(s),
    },
    {
      name: 'defaults: all keys valid',
      seed: {
        'lvm.defaults.theme': 'dark',
        'lvm.defaults.chordStyle': 'solfege',
        'lvm.defaults.keepAwake': '1',
        'lvm.defaults.language': 'ko',
        'lvm.defaults.dailyWordDestination': 'reader',
      },
      run: async (s) => hydrateDefaults(s),
    },
    {
      name: 'defaults: every key malformed',
      seed: {
        'lvm.defaults.theme': 'neon',
        'lvm.defaults.chordStyle': 'numbers',
        'lvm.defaults.keepAwake': 'true',
        'lvm.defaults.language': '   ',
        'lvm.defaults.dailyWordDestination': 'somewhere',
      },
      run: async (s) => hydrateDefaults(s),
    },
    {
      name: 'recents: malformed JSON',
      seed: { 'lvm.recents.songs.v1': '{not json' },
      run: async (s) => {
        await hydrateRecents(s)
        return getRecentlyOpened()
      },
    },
    {
      name: 'recents: valid rows plus one junk row',
      seed: {
        'lvm.recents.songs.v1': JSON.stringify([
          { slug: 'a', title: 'A', openedAt: '2026-01-01T00:00:00Z' },
          { slug: 'b' },
        ]),
      },
      run: async (s) => {
        await hydrateRecents(s)
        return getRecentlyOpened()
      },
    },
    {
      name: 'reading streak: wrong shape',
      seed: { 'lvm.readingStreak.v1': JSON.stringify({ enabled: 'yes' }) },
      run: async (s) => {
        await hydrateReadingStreak(s)
        return getReadingStreak()
      },
    },
    {
      name: 'reader reminder: out-of-range hour is clamped',
      seed: { 'lvm.readerReminder.v1': JSON.stringify({ enabled: true, hour: 99, minute: -5 }) },
      run: async (s) => {
        await hydrateReaderReminder(s)
        return getReaderReminder()
      },
    },
    {
      name: 'viewer prefs: valid v2 payload',
      seed: { 'lvm.viewer.columns.v2': JSON.stringify({ columns: 3 }) },
      run: async (s) => {
        await hydrateViewerPrefs(s)
        return getColumns()
      },
    },
    {
      name: 'viewer prefs: malformed v1 payload falls back to the default',
      seed: { 'lvm.viewer.columnMode.v1': 'null' },
      run: async (s) => {
        await hydrateViewerPrefs(s)
        return getColumns()
      },
    },
    {
      name: 'today’s reflection: cached entry',
      seed: {
        'lvm.reflection.today.v1': JSON.stringify({
          userId: 'user-1',
          date: '2026-08-07',
          reflection: {
            id: 'r1',
            user_id: 'user-1',
            reflection_date: '2026-08-07',
            content_key: null,
            visibility: 'private',
            body: 'cached',
            created_at: '2026-08-07T09:00:00Z',
          },
        }),
      },
      run: async (s) => {
        // Module-level store, and `run` is called twice (direct then batched) —
        // reset so the second pass genuinely re-reads rather than seeing the first.
        __resetReflectionDayStoreForTest()
        await hydrateTodayReflection(s, REFLECTION_NOW)
        return getReflectionDay(reflectionCacheKey('user-1', '2026-08-07')) ?? null
      },
    },
    {
      name: 'today’s reflection: entry from an earlier day is dropped',
      seed: {
        'lvm.reflection.today.v1': JSON.stringify({
          userId: 'user-1',
          date: '2026-08-06',
          reflection: null,
        }),
      },
      run: async (s) => {
        __resetReflectionDayStoreForTest()
        await hydrateTodayReflection(s, REFLECTION_NOW)
        return getReflectionDay(reflectionCacheKey('user-1', '2026-08-06')) ?? null
      },
    },
    {
      name: 'bible translation: whitespace only',
      seed: { 'lvm.bible.translation.v1': '   ' },
      run: async (s) => {
        await hydrateBibleTranslationPref(s)
        return getBibleTranslationPref()
      },
    },
    {
      name: 'bible translation: valid pick',
      seed: { 'lvm.bible.translation.v1': 'KJV' },
      run: async (s) => {
        await hydrateBibleTranslationPref(s)
        return getBibleTranslationPref()
      },
    },
    {
      name: 'reader settings: stored pick',
      seed: {
        'lvm.reader.settings.v1': JSON.stringify({
          pt: 18,
          typeface: 'sans',
          layout: 'prose',
          lineSpacing: 'relaxed',
        }),
      },
      run: async (s) => {
        __resetReaderSettingsForTest()
        await hydrateReaderSettings(s)
        return getReaderSettings()
      },
    },
    {
      name: 'reader settings: malformed payload',
      seed: { 'lvm.reader.settings.v1': '{ not json' },
      run: async (s) => {
        __resetReaderSettingsForTest()
        await hydrateReaderSettings(s)
        return getReaderSettings()
      },
    },
  ]

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const direct = makeStore(testCase.seed)
      const unbatched = await testCase.run(direct.store)

      const batched = makeStore(testCase.seed)
      const primed = await primeLaunchStorage(batched.store)
      const viaBatch = await testCase.run(primed)

      expect(viaBatch).toStrictEqual(unbatched)
    })
  }

  it('pins the documented defaults so a drift shows up here', async () => {
    const { store } = makeStore()
    const primed = await primeLaunchStorage(store)
    await expect(hydrateDefaults(primed)).resolves.toStrictEqual(DEFAULT_APP_DEFAULTS)
    await hydrateReadingStreak(primed)
    expect(getReadingStreak()).toStrictEqual(DEFAULT_READING_STREAK)
    await hydrateReaderReminder(primed)
    expect(getReaderReminder()).toStrictEqual(DEFAULT_READER_REMINDER)
    await hydrateBibleTranslationPref(primed)
    expect(getBibleTranslationPref()).toBe('')
    await hydrateRecents(primed)
    expect(getRecentlyOpened()).toStrictEqual([])
    await hydrateViewerPrefs(primed)
    expect(getColumns()).toBe(DEFAULT_COLUMNS)
    __resetReaderSettingsForTest()
    await hydrateReaderSettings(primed)
    expect(getReaderSettings()).toStrictEqual(defaultReaderSettings)
  })

  it('keeps defaults.ts all-or-nothing on a per-key read failure', async () => {
    // Pre-existing behaviour worth pinning: defaults.ts wraps its five reads in
    // Promise.all, so one rejecting read discards all five. The batch must not
    // quietly "improve" this into per-key degradation either.
    const { store } = makeStore({ 'lvm.defaults.theme': 'dark' })
    const failing = {
      ...store,
      getItem: vi.fn(async (key: string) => {
        if (key === 'lvm.defaults.chordStyle') throw new Error('read failed')
        return store.getItem(key)
      }),
    } as unknown as BatchKVStorage
    await expect(hydrateDefaults(failing)).resolves.toStrictEqual(DEFAULT_APP_DEFAULTS)
  })
})
