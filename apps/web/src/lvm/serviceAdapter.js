import { toSong } from '@lavozmisionera/core/setlists/worshipPlan.js'

export { toSong }

const SCHEMA_VERSION = '0.1'

export function buildService(plan, catalog) {
  if (!plan?.id || !plan?.title || !plan?.startsAt || !Array.isArray(plan?.setlist?.entries || plan?.setlist?.songIds)) {
    throw new Error('Incomplete service plan')
  }
  if (Number.isNaN(Date.parse(plan.startsAt))) throw new Error('Invalid service date')

  const byId = new Map(catalog.flatMap((song) => [[song.id, song], ...(song.dbId ? [[song.dbId, song]] : [])]))
  const entries = plan.setlist.entries || plan.setlist.songIds.map((songId) => ({ songId }))
  const songItems = entries.map(({ songId, sectionOrder, toKey }, index) => {
    const entry = byId.get(songId)
    if (!entry) throw new Error(`Missing song ${songId}`)
    return { id: `song-${index + 1}`, kind: 'SONG', song: toSong(entry, sectionOrder, toKey) }
  })

  return {
    schemaVersion: SCHEMA_VERSION,
    id: plan.id,
    title: plan.title,
    startsAt: plan.startsAt,
    setlist: { id: plan.setlist.id, name: plan.setlist.name },
    items: [
      ...songItems,
      ...((plan.scriptures || (plan.scripture ? [plan.scripture] : [])).map((scripture, index) => ({
        id: `scripture-${index + 1}`, kind: 'SCRIPTURE', scripture,
      }))),
      ...(plan.announcement ? [{ id: 'announcement-1', kind: 'ANNOUNCEMENT', announcement: plan.announcement }] : []),
      ...(plan.sermon ? [{ id: 'sermon-1', kind: 'SERMON', sermon: plan.sermon }] : []),
    ],
  }
}

export function buildServiceFromSetlist({ id, name, serviceDate, items, songs, now = new Date() }) {
  if (!Array.isArray(items) || !items.length) throw new Error('Setlist is empty')
  const entries = items.map((item) => {
    if (item.song?.verse) throw new Error(`Scripture ${item.song.title} needs local verse text before export`)
    const text = item.sectionOrderText?.trim()
    if (text && !/^\d+(\s*,\s*\d+)*$/.test(text)) {
      throw new Error(`Invalid section order for ${item.song?.title || item.songId}`)
    }
    return {
      songId: item.songId,
      ...(text ? { sectionOrder: text.split(',').map((n) => Number(n.trim())) } : {}),
      ...(item.toKey ? { toKey: item.toKey } : {}),
    }
  })
  const date = serviceDate ? new Date(serviceDate) : now
  if (Number.isNaN(date.getTime())) throw new Error('Invalid service date')
  return buildService({
    id: `worship-${id || 'draft'}-${date.toISOString().slice(0, 10)}`,
    title: name?.trim() || 'Repertorio',
    startsAt: date.toISOString(),
    setlist: { id: id || 'draft', name: name?.trim() || 'Repertorio', entries },
  }, songs)
}
