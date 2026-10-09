import { parseChordProOrLegacy } from './parser'
import { serializeChordPro, slugifyUnderscore } from './serialize'
import type { SongDoc } from './types'

export type MetaExtras = {
  country?: string
  tags?: string[] | string
  youtube?: string
  mp3?: string
  pptx?: string
  added?: string
}

const TITLE_DECORATIONS = [
  /\((israeli|iranian|hindi|arabic|.*?\blanguage\b)\)/ig,
  /\bkey\s+of\s+[A-G][#b]?m?\b/ig,
]

function canonicalTitle(value: unknown){
  return TITLE_DECORATIONS
    .reduce((title, pattern) => title.replace(pattern, ''), String(value || ''))
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function normalizeTags(tags: MetaExtras['tags']){
  return Array.isArray(tags) ? tags.join(', ') : tags || ''
}

function suppliedExtras(extras: Partial<MetaExtras>){
  const values: Record<string, string> = {}
  for (const key of ['country', 'youtube', 'mp3', 'pptx', 'added'] as const) {
    if (extras[key]) values[key] = extras[key]!
  }
  const tags = normalizeTags(extras.tags)
  if (tags) values.tags = tags
  return values
}

export function convertToCanonicalChordPro(raw: string, extras: Partial<MetaExtras> = {}){
  const doc: SongDoc = parseChordProOrLegacy(raw)
  doc.meta = {
    title: canonicalTitle(doc.meta?.title),
    key: (doc.meta?.key || '').trim(),
    capo: doc.meta?.capo,
    meta: {
      ...(doc.meta?.meta || {}),
      ...suppliedExtras(extras),
    }
  }

  const text = serializeChordPro(doc, { useDirectives: true })
  const docTitle = canonicalTitle(doc.meta.title || 'Untitled')
  return { text, docTitle, docKey: doc.meta.key }
}

export function suggestCanonicalFilename(title: string){
  return `${slugifyUnderscore(canonicalTitle(title || 'untitled'))}.chordpro`
}
