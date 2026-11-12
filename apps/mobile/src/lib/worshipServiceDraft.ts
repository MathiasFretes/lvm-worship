import AsyncStorage from '@react-native-async-storage/async-storage'
import { buildWorshipPlanFromSetlist, parseWorshipContext, toSong } from '@lavozmisionera/core/setlists/worshipPlan.js'
import { uuidv4 } from './uuid'

type Song = { id: string; title: string; originalKey: string; chordpro_content: string }
type Entry = { id: string; song: Song; toKey: string | null }
export type ServiceDraft = { context: ReturnType<typeof parseWorshipContext>; entries: Entry[] }

const key = (userId: string) => `lvm.worship.service-draft.v1.${userId}`
let pending: Promise<unknown> = Promise.resolve()

async function read(userId: string): Promise<ServiceDraft | null> {
  const raw = await AsyncStorage.getItem(key(userId))
  return raw ? JSON.parse(raw) as ServiceDraft : null
}

export async function readServiceDraft(userId: string) {
  await pending
  return read(userId)
}

function update(userId: string, change: (draft: ServiceDraft | null) => ServiceDraft | null) {
  const write = pending.then(async () => {
    const current = await read(userId)
    const next = change(current)
    if (next && next !== current) await AsyncStorage.setItem(key(userId), JSON.stringify(next))
    return next
  })
  pending = write.catch(() => undefined)
  return write
}

export function saveServiceContext(userId: string, input: unknown) {
  const context = parseWorshipContext(input)
  return update(userId, (current) => ({
    context,
    entries: current && current.context.serviceId === context.serviceId && current.context.setlistId === context.setlistId
      ? current.entries : [],
  }))
}

export function addSongToServiceDraft(userId: string, song: Song, toKey: string | null) {
  return update(userId, (current) => {
    if (!current) return null
    toSong(song, undefined, toKey)
    return { ...current, entries: [...current.entries, { id: uuidv4(), song, toKey }] }
  })
}

export function editServiceDraftEntries(userId: string, entryId: string, action: 'up' | 'down' | 'remove') {
  return update(userId, (current) => {
    if (!current) return current
    const index = current.entries.findIndex((entry) => entry.id === entryId)
    if (index < 0) return current
    const entries = current.entries.slice()
    const target = index + (action === 'up' ? -1 : 1)
    if (action === 'remove') entries.splice(index, 1)
    else if (entries[target]) [entries[index], entries[target]] = [entries[target], entries[index]]
    return { ...current, entries }
  })
}

export function exportServiceDraft(draft: ServiceDraft) {
  return buildWorshipPlanFromSetlist({
    context: draft.context,
    songs: draft.entries.map(({ song }) => song),
    items: draft.entries.map(({ song, toKey }) => ({ songId: song.id, sourceSong: song, toKey })),
  })
}
