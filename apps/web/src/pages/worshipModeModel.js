import { parseChordProOrLegacy } from '../utils/chordpro/parser'
import { stepsBetween } from '../utils/chordpro'
import { isVerseId, parseVerseId } from '../utils/songs/verseRef'
import { fetchBibleChapter } from '../utils/bible/chapters'
import { listBibleTranslations } from '../utils/bible/translations'
import { isRtlBibleLanguage } from '../utils/bible/direction'

export const WORSHIP_SESSION_KEY = 'worship:session'
export const WORSHIP_SESSION_TTL = 30 * 60 * 1000

export function decodeSongIds(value = '') {
  return value.split(',').map((part) => {
    try { return decodeURIComponent(part.trim()) } catch { return part.trim() }
  }).filter(Boolean)
}

export function readWorshipSession(ids) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(WORSHIP_SESSION_KEY) || 'null')
    if (saved?.idsString !== ids.join(',')) return null
    if (!Number.isFinite(saved.ts) || Date.now() - saved.ts > WORSHIP_SESSION_TTL) return null
    return saved
  } catch { return null }
}

export function setlistReturnUrl(ids, keys) {
  if (!ids.length) return '/setlist'
  const encodedIds = ids.map(encodeURIComponent).join(',')
  const encodedKeys = ids.map((_, index) => encodeURIComponent(keys[index] || '')).join(',')
  return `/setlist/${encodedIds}?toKeys=${encodedKeys}`
}

export function songFromCatalog(entry) {
  const document = parseChordProOrLegacy(entry.chordpro_content || '')
  return {
    id: entry.id,
    title: document?.meta?.title || entry.title || entry.id,
    baseKey: document?.meta?.key || document?.meta?.originalkey || entry.originalKey || 'C',
    type: 'song',
    sections: (document.sections || []).map((section) => ({
      label: section.label,
      lines: (section.lines || []).map((line) => ({
        plain: line.comment || line.lyrics || '',
        chords: line.chords || [],
        comment: !!line.comment,
        instrumental: line.instrumental,
      })),
    })),
  }
}

async function verseFromReference(id, languageByTranslation, chapterCache) {
  const reference = parseVerseId(id)
  if (!reference) return null
  const lines = []
  for (const segment of reference.segments || []) {
    const cacheKey = `${reference.translation}:${reference.bookNumber}:${segment.chapter}`
    if (!chapterCache.has(cacheKey)) {
      chapterCache.set(cacheKey, await fetchBibleChapter({
        translationId: reference.translation,
        book: String(reference.bookNumber),
        chapter: segment.chapter,
      }))
    }
    const chapter = chapterCache.get(cacheKey)
    const available = Object.keys(chapter?.verses || {}).map(Number).sort((a, b) => a - b)
    const max = available.at(-1) || 0
    const selected = segment.ranges
      ? segment.ranges.flatMap(({ start, end }) => Array.from({ length: Math.max(0, (end ?? max) - start + 1) }, (_, i) => start + i))
      : available
    for (const number of selected) {
      const text = chapter?.verses?.[String(number)]
      if (text) lines.push({ verse: true, chapter: segment.chapter, number, text, showChapter: reference.segments.length > 1 })
    }
  }
  return {
    id: reference.id,
    title: reference.refDisplay,
    baseKey: null,
    type: 'verse',
    rtl: isRtlBibleLanguage(languageByTranslation.get(reference.translation) || ''),
    sections: [{ label: '', lines }],
  }
}

export async function loadWorshipEntries(ids, catalog) {
  const languageByTranslation = new Map()
  const chapterCache = new Map()
  if (ids.some(isVerseId)) {
    try {
      const result = await listBibleTranslations()
      for (const item of result?.translations || []) languageByTranslation.set(String(item.id), item.language || '')
    } catch { /* A chapter may still be available without translation metadata. */ }
  }
  const entries = []
  for (const id of ids) {
    if (isVerseId(id)) {
      try {
        const verse = await verseFromReference(id, languageByTranslation, chapterCache)
        if (verse) entries.push(verse)
      } catch { /* The remaining entries should still be usable offline. */ }
      continue
    }
    const song = catalog.get(String(id))
    if (song) entries.push(songFromCatalog(song))
  }
  return entries
}

export function initialOffsets(entries, keys, singleKey, session) {
  const explicit = (keys.length === entries.length && keys.some(Boolean)) || (!!singleKey && entries.length === 1)
  const base = entries.map((entry, index) => {
    if (entry.type === 'verse') return 0
    const key = (keys.length === entries.length ? keys[index] : '') || (entries.length === 1 ? singleKey : '')
    return key ? stepsBetween(entry.baseKey, key) : 0
  })
  if (!explicit && session?.baseOffsets?.length === entries.length) {
    return { base: session.baseOffsets, current: session.offsets?.length === entries.length ? session.offsets : session.baseOffsets }
  }
  return { base, current: base.slice() }
}
