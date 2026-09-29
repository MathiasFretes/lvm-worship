import { toSong } from './serviceAdapter'

function object(value, path, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected an object`)
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`${path}.${key}: unknown field`)
  return value
}

function required(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path}: expected non-empty text`)
}

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
      const entry = byId.get(item.songId)
      if (!entry) throw new Error(`No se encontró la canción ${item.songId}`)
      const text = item.sectionOrderText?.trim()
      if (text && !/^\d+(\s*,\s*\d+)*$/.test(text)) throw new Error(`Orden de secciones inválido para ${entry.title}`)
      const arrangement = text ? text.split(',').map((n) => Number(n.trim())) : undefined
      const song = toSong(entry, arrangement, item.toKey)
      return { songId: song.id, title: song.title, key: song.key, arrangement: arrangement || song.sections.map((_, index) => index + 1), sections: song.sections }
    }),
  }
}
