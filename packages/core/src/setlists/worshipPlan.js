import { parseChordProOrLegacy } from '../chordpro/parser'
import { stepsBetween, transposeSymPrefer } from '../chordpro/index.js'

export function toSong(entry, sectionOrder, toKey) {
  const parsed = parseChordProOrLegacy(entry.chordpro_content || '')
  const sourceSections = parsed.sections
    .map((section) => ({
      kind: section.kind,
      label: section.label || section.kind,
      lines: section.lines
        .filter((line) => line.lyrics.trim())
        .map((line) => ({
          text: line.lyrics,
          chords: line.chords.map(({ sym, index }) => ({ symbol: sym, index })),
        })),
    }))
    .filter((section) => section.lines.length)

  if (!sourceSections.length) throw new Error(`Song ${entry.id} has no lyrics to present`)
  const order = sectionOrder == null ? sourceSections.map((_, index) => index + 1) : sectionOrder
  if (!Array.isArray(order) || !order.length || order.some((n) => !Number.isInteger(n) || n < 1 || n > sourceSections.length)) {
    throw new Error(`Invalid section order for ${entry.title}: use numbers 1–${sourceSections.length}`)
  }
  const sourceKey = entry.originalKey || parsed.meta.key || ''
  const steps = stepsBetween(sourceKey, toKey)
  const sections = order.map((n) => sourceSections[n - 1]).map((section) => ({
    ...section,
    lines: section.lines.map((line) => ({
      ...line,
      chords: line.chords.map((chord) => ({
        ...chord,
        symbol: toKey ? transposeSymPrefer(chord.symbol, steps, toKey.includes('b')) : chord.symbol,
      })),
    })),
  }))
  return {
    id: entry.id,
    title: entry.title,
    key: toKey || sourceKey,
    sections,
  }
}

function object(value, path, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected an object`)
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`${path}.${key}: unknown field`)
  return value
}

function required(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path}: expected non-empty text`)
}

/** @returns {{ schemaVersion: '0.1', serviceId: string, title: string, startsAt: string, setlistId: string, name: string }} */
export function parseWorshipContext(value) {
  const context = object(value, 'context', ['schemaVersion', 'serviceId', 'title', 'startsAt', 'setlistId', 'name'])
  if (context.schemaVersion !== '0.1') throw new Error('context.schemaVersion: unsupported version; expected 0.1')
  for (const field of ['serviceId', 'title', 'startsAt', 'setlistId', 'name']) required(context[field], `context.${field}`)
  if (Number.isNaN(Date.parse(context.startsAt))) throw new Error('context.startsAt: invalid date')
  return context
}

export function buildWorshipPlanFromSetlist({ context, items, songs }) {
  const source = parseWorshipContext(context)
  if (!Array.isArray(items) || !items.length) throw new Error('El repertorio está vacío')
  const byId = new Map(songs.flatMap((song) => [[song.id, song], ...(song.dbId ? [[song.dbId, song]] : [])]))
  return {
    schemaVersion: '0.1',
    serviceId: source.serviceId,
    setlistId: source.setlistId,
    name: source.name,
    songs: items.map((item) => {
      if (item.song?.verse) throw new Error('WorshipPlan solo admite canciones; quita los versículos del repertorio')
      const entry = item.sourceSong?.id === item.songId ? item.sourceSong : byId.get(item.songId)
      if (!entry) throw new Error(`No se encontró la canción ${item.songId}`)
      const text = item.sectionOrderText?.trim()
      if (text && !/^\d+(\s*,\s*\d+)*$/.test(text)) throw new Error(`Orden de secciones inválido para ${entry.title}`)
      const arrangement = text ? text.split(',').map((n) => Number(n.trim())) : undefined
      const song = toSong(entry, arrangement, item.toKey)
      return { songId: song.id, title: song.title, key: song.key, arrangement: arrangement || song.sections.map((_, index) => index + 1), sections: song.sections }
    }),
  }
}

