import { parseVerseId, fetchPersonalSongById } from '@lavozmisionera/core'
import { prepareOfflineSetlist } from '@lavozmisionera/core/setlists/offlineSetlists'
import { fetchBibleChapter } from '../../utils/bible/chapters'

function snapshotSong(song) {
  return {
    id: song.dbId || song.id, slug: song.slug ?? song.id ?? null,
    title: song.title, artist: song.artist ?? song.authors?.join(', ') ?? null,
    default_key: song.default_key ?? song.originalKey ?? null,
    tempo: song.tempo ?? null, time_signature: song.time_signature ?? song.timeSignature ?? null,
    chordpro_content: song.chordpro_content ?? null,
  }
}

export async function downloadRehearsal(input, { client, catalog, onProgress, fetchChapter = fetchBibleChapter }) {
  const chapters = new Map()
  return prepareOfflineSetlist(input, {
    onProgress,
    async fetchSong(id, slug) {
      const local = catalog.byDbId?.get(id) || catalog.byId?.get(id) || catalog.byId?.get(slug)
      if (local?.chordpro_content?.trim()) return snapshotSong(local)
      if (id.startsWith('personal:')) {
        const song = await fetchPersonalSongById(client, id.slice('personal:'.length))
        return song ? snapshotSong(song) : null
      }
      const query = client.from('songs').select('id,slug,title,artist,default_key,tempo,time_signature,chordpro_content').eq('is_deleted', false)
      const { data, error } = await (slug ? query.eq('slug', slug) : query.eq('id', id)).maybeSingle()
      if (error) throw error
      return data ? snapshotSong(data) : null
    },
    async fetchReading(id) {
      const parsed = parseVerseId(id)
      if (!parsed?.segments?.length) throw new Error('Invalid scripture reference')
      const lines = []
      const seen = new Set()
      for (const segment of parsed.segments) {
        const key = `${parsed.translation}:${parsed.bookNumber}:${segment.chapter}`
        if (!chapters.has(key)) chapters.set(key, await fetchChapter({ translationId: parsed.translation, book: String(parsed.bookNumber), chapter: segment.chapter }))
        const chapter = chapters.get(key)
        const available = Object.keys(chapter?.verses || {}).map(Number).filter(Number.isInteger).sort((a, b) => a - b)
        if (!available.length) throw new Error('Missing scripture chapter')
        const ranges = segment.ranges || available.map(number => ({ start: number, end: number }))
        for (const range of ranges) {
          const end = range.end ?? available.at(-1)
          if (end < range.start || end - range.start > 1000) throw new Error('Invalid scripture range')
          for (let number = range.start; number <= end; number += 1) {
            const text = chapter.verses[String(number)]
            if (typeof text !== 'string' || !text.trim()) throw new Error('Incomplete scripture reading')
            const verseKey = `${segment.chapter}:${number}`
            if (!seen.has(verseKey)) {
              seen.add(verseKey)
              lines.push({ verse: true, chapter: segment.chapter, number, text, showChapter: parsed.segments.length > 1 })
            }
          }
        }
      }
      return lines
    },
  })
}
