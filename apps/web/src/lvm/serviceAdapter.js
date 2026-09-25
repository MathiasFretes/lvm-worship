import { parseChordProOrLegacy } from '@gracechords/core/chordpro/parser'

const SCHEMA_VERSION = '0.1'

function toSong(entry) {
  const parsed = parseChordProOrLegacy(entry.chordpro_content || '')
  const sections = parsed.sections
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

  if (!sections.length) throw new Error(`Song ${entry.id} has no lyrics to present`)
  return {
    id: entry.id,
    title: entry.title,
    key: entry.originalKey || parsed.meta.key || '',
    sections,
  }
}

export function buildService(plan, catalog) {
  if (!plan?.id || !plan?.title || !plan?.startsAt || !Array.isArray(plan?.setlist?.songIds)) {
    throw new Error('Incomplete service plan')
  }
  if (Number.isNaN(Date.parse(plan.startsAt))) throw new Error('Invalid service date')

  const byId = new Map(catalog.map((song) => [song.id, song]))
  const songItems = plan.setlist.songIds.map((id, index) => {
    const entry = byId.get(id)
    if (!entry) throw new Error(`Missing song ${id}`)
    return { id: `song-${index + 1}`, kind: 'SONG', song: toSong(entry) }
  })

  return {
    schemaVersion: SCHEMA_VERSION,
    id: plan.id,
    title: plan.title,
    startsAt: plan.startsAt,
    setlist: { id: plan.setlist.id, name: plan.setlist.name },
    items: [
      ...songItems,
      { id: 'scripture-1', kind: 'SCRIPTURE', scripture: plan.scripture },
      { id: 'announcement-1', kind: 'ANNOUNCEMENT', announcement: plan.announcement },
      { id: 'sermon-1', kind: 'SERMON', sermon: plan.sermon },
    ],
  }
}
