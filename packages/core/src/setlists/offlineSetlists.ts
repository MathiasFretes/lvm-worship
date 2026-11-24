import type { VerseLine } from '../bible/verseLines'

export const OFFLINE_SETLIST_BYTES = 16 * 1024 * 1024
export type RehearsalSong = {
  id: string; slug: string | null; title: string; artist: string | null
  default_key: string | null; tempo: number | null; time_signature: string | null
  chordpro_content: string | null
}
export type RehearsalItem = {
  entryKey: string; songId: string; toKey: string | null; notes: string | null
  sectionOrderText?: string
  song: RehearsalSong; verseLines: VerseLine[] | null
}
export type OfflineSetlist = {
  id: string; name: string; serviceDate: string | null; updatedAt: string | null
  savedAt: string; items: RehearsalItem[]
}

function text(value: unknown, nullable = false, limit = 1024): void {
  if (nullable && value === null) return
  if (typeof value !== 'string' || value.length > limit || !nullable && !value) throw new Error('Invalid offline setlist text')
}

function utf8Bytes(value: string): number {
  let bytes=0
  for(const character of value){
    const point=character.codePointAt(0)!
    bytes+=point<=0x7f?1:point<=0x7ff?2:point<=0xffff?3:4
  }
  return bytes
}

function snapshotSong(song: RehearsalSong): RehearsalSong {
  return {id:song.id,slug:song.slug,title:song.title,artist:song.artist,
    default_key:song.default_key,tempo:song.tempo,time_signature:song.time_signature,
    chordpro_content:song.chordpro_content}
}

function snapshotSetlist(setlist: OfflineSetlist): OfflineSetlist {
  return {id:setlist.id,name:setlist.name,serviceDate:setlist.serviceDate,
    updatedAt:setlist.updatedAt,savedAt:setlist.savedAt,
    items:setlist.items.map(item=>({entryKey:item.entryKey,songId:item.songId,toKey:item.toKey,
      notes:item.notes,sectionOrderText:item.sectionOrderText??'',song:snapshotSong(item.song),verseLines:item.verseLines?.map(line=>({
        verse:true,chapter:line.chapter,number:line.number,text:line.text,showChapter:line.showChapter,
      }))??null}))}
}

export function validateOfflineSetlist(value: unknown): asserts value is OfflineSetlist {
  if (!value || typeof value !== 'object') throw new Error('Invalid offline setlist')
  const set = value as OfflineSetlist
  for (const field of [set.id, set.name, set.savedAt]) text(field)
  for (const field of [set.serviceDate, set.updatedAt]) text(field, true)
  if (!Number.isFinite(Date.parse(set.savedAt))) throw new Error('Invalid offline save date')
  if (!Array.isArray(set.items) || set.items.length > 500) throw new Error('Invalid offline setlist entries')
  const keys = new Set<string>()
  for (const item of set.items) {
    if (!item || !item.song) throw new Error('Incomplete offline setlist')
    text(item.entryKey); text(item.songId); text(item.toKey, true); text(item.notes, true, 16384)
    if (item.sectionOrderText !== undefined) text(item.sectionOrderText, true, 16384)
    if (keys.has(item.entryKey)) throw new Error('Duplicate offline entry key')
    keys.add(item.entryKey)
    const song = item.song
    text(song.id); text(song.title); text(song.slug, true)
    for (const field of [song.artist, song.default_key, song.time_signature]) text(field, true)
    if (song.tempo !== null && (typeof song.tempo !== 'number' || !Number.isFinite(song.tempo))) throw new Error('Invalid offline tempo')
    text(song.chordpro_content, true, 256 * 1024)
    if (item.songId.startsWith('v:')) {
      if (!Array.isArray(item.verseLines) || !item.verseLines.length || item.verseLines.length > 1000) throw new Error('Missing offline reading')
      for (const line of item.verseLines) {
        if (!line || line.verse !== true || !Number.isInteger(line.chapter) || line.chapter < 1 || !Number.isInteger(line.number) || line.number < 1 || typeof line.showChapter !== 'boolean') throw new Error('Invalid offline reading')
        text(line.text, false, 16384)
      }
    } else if (!song.chordpro_content?.trim() || item.verseLines !== null) throw new Error('Missing offline chart')
  }
}

export function createOfflineSetlists(storage: {
  read: (ownerId: string) => Promise<string | null>
  write: (ownerId: string, raw: string) => Promise<void>
  // Platforms with transactions must read and replace within the same transaction.
  update?: (ownerId: string, change: (raw: string | null) => string) => Promise<void>
}) {
  const queues = new Map<string, Promise<unknown>>()
  async function read(ownerId: string): Promise<OfflineSetlist[]> {
    if (!ownerId) return []
    text(ownerId)
    return decode(ownerId, await storage.read(ownerId))
  }
  function decode(ownerId: string, raw: string | null): OfflineSetlist[] {
    if(raw===null)return []
    if(typeof raw!=='string'||raw.length>OFFLINE_SETLIST_BYTES||utf8Bytes(raw)>OFFLINE_SETLIST_BYTES)throw new Error('Offline setlists exceed storage budget')
    const record = JSON.parse(raw)
    if (record.version !== 1 || record.ownerId !== ownerId || !Array.isArray(record.setlists) || record.setlists.length > 50) throw new Error('Invalid offline setlist storage')
    record.setlists.forEach(validateOfflineSetlist)
    if(new Set(record.setlists.map((set: OfflineSetlist)=>set.id)).size!==record.setlists.length)throw new Error('Duplicate offline setlist')
    return record.setlists.map(snapshotSetlist)
  }
  function update(ownerId: string, change: (sets: OfflineSetlist[]) => OfflineSetlist[]) {
    text(ownerId)
    const operation = (queues.get(ownerId) ?? Promise.resolve()).then(async () => {
      const encode = (previous: string | null) => {
      const setlists = change(decode(ownerId, previous))
      if (setlists.length > 50) throw new Error('Offline setlist limit reached')
      const raw = JSON.stringify({ version: 1, ownerId, setlists })
      if (raw.length > OFFLINE_SETLIST_BYTES || utf8Bytes(raw)>OFFLINE_SETLIST_BYTES) throw new Error('Offline setlists exceed storage budget')
      return raw
      }
      if (storage.update) await storage.update(ownerId, encode)
      else await storage.write(ownerId, encode(await storage.read(ownerId)))
    })
    const completed=operation.then(()=>{},()=>{})
    queues.set(ownerId, completed)
    completed.then(()=>{if(queues.get(ownerId)===completed)queues.delete(ownerId)})
    return operation
  }
  return {
    read,
    save(ownerId: string, setlist: OfflineSetlist) {
      validateOfflineSetlist(setlist)
      // Freeze the submitted content before entering the serialized write queue.
      const snapshot = snapshotSetlist(setlist)
      return update(ownerId, sets => [snapshot, ...sets.filter(set => set.id !== snapshot.id)])
    },
    remove(ownerId: string, setlistId: string) {
      return update(ownerId, sets => sets.filter(set => set.id !== setlistId))
    },
  }
}

export async function prepareOfflineSetlist(input: Omit<OfflineSetlist, 'savedAt' | 'items'> & {
  items: Array<Omit<RehearsalItem, 'song' | 'verseLines'> & { song: Omit<RehearsalSong, 'chordpro_content'> }>
}, deps: {
  fetchSong: (songId: string, slug: string | null) => Promise<RehearsalSong | null>
  fetchReading: (verseId: string) => Promise<VerseLine[]>
  onProgress?: (done: number, total: number) => void
}): Promise<OfflineSetlist> {
  const items: RehearsalItem[] = []
  const songs = new Map<string, RehearsalSong>()
  let bytes=utf8Bytes(JSON.stringify({id:input.id,name:input.name,serviceDate:input.serviceDate,updatedAt:input.updatedAt}))+128
  for (const entry of input.items) {
    let song: RehearsalSong, verseLines: VerseLine[] | null = null
    if (entry.songId.startsWith('v:')) {
      verseLines = await deps.fetchReading(entry.songId)
      song = snapshotSong({ ...entry.song, chordpro_content: null })
    } else {
      const loaded = songs.get(entry.songId) ?? await deps.fetchSong(entry.songId, entry.song.slug)
      if (!loaded) throw new Error('Missing offline song')
      songs.set(entry.songId, snapshotSong(loaded))
      song = snapshotSong(loaded)
    }
    const item={entryKey:entry.entryKey,songId:entry.songId,toKey:entry.toKey,notes:entry.notes,sectionOrderText:entry.sectionOrderText??'',song,verseLines}
    bytes+=utf8Bytes(JSON.stringify(item))+1
    if(bytes>OFFLINE_SETLIST_BYTES)throw new Error('Offline setlists exceed storage budget')
    items.push(item)
    deps.onProgress?.(items.length, input.items.length)
  }
  const result = { id:input.id,name:input.name,serviceDate:input.serviceDate,updatedAt:input.updatedAt,savedAt: new Date().toISOString(), items }
  validateOfflineSetlist(result)
  return snapshotSetlist(result)
}
