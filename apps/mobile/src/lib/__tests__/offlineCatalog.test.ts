import { describe, expect, it } from 'vitest'
import { createOfflineCatalog } from '../../../../../packages/core/src/songs/offlineCatalog'

const song = (id = 'one') => ({ id, slug: `song-${id}`, title: `Song ${id}`, artist: 'Artist',
  default_key: 'D', time_signature: '4/4', tempo: 96, tags: ['Prayer'], created_at: '2026-01-01',
  chordpro_content: '{title: Song}\n[D]Dios de [A]amor' })

describe('persistent public song catalog', () => {
  it('restores charts and metadata after a new store is created without a network', async () => {
    let disk: string | null = null
    const storage = { read: async () => disk, write: async (raw: string) => { disk = raw } }
    await createOfflineCatalog(storage).write([song()])
    expect(await createOfflineCatalog(storage).read()).toEqual([song()])
  })

  it('keeps tags and dates when a viewer refresh only supplies chart fields, and skips unchanged writes', async () => {
    let disk: string | null = null, writes = 0
    const store = createOfflineCatalog({ read: async () => disk, write: async raw => { writes++; disk = raw } })
    await store.write([song()])
    await store.upsert({ id: 'one', slug: 'song-one', title: 'Song one', chordpro_content: 'New chart' })
    expect((await store.read())[0]).toMatchObject({ tags: ['Prayer'], created_at: '2026-01-01', chordpro_content: 'New chart' })
    expect(writes).toBe(2)
    await store.upsert({ id: 'one', slug: 'song-one', title: 'Song one', chordpro_content: 'New chart' })
    expect(writes).toBe(2)
  })

  it('serializes simultaneous additions so the final persisted snapshot keeps both songs', async () => {
    let disk: string | null = null
    const store = createOfflineCatalog({ read: async () => disk, write: async raw => { disk = raw } })
    await Promise.all([store.upsert(song('a')), store.upsert(song('b'))])
    expect((await createOfflineCatalog({ read: async () => disk, write: async () => {} }).read()).map(row => row.id)).toEqual(['a', 'b'])
  })

  it('retains the last persisted snapshot after storage failure and retries the same current data', async () => {
    let disk: string | null = null, fail = false
    const storage = { read: async () => disk, write: async (raw: string) => { if (fail) throw new Error('disk full'); disk = raw } }
    const store = createOfflineCatalog(storage)
    await store.write([song('a')])
    fail = true
    await expect(store.upsert(song('b'))).rejects.toThrow('disk full')
    expect((await createOfflineCatalog(storage).read()).map(row => row.id)).toEqual(['a'])
    fail = false
    await store.upsert(song('b'))
    expect((await createOfflineCatalog(storage).read()).map(row => row.id)).toEqual(['a', 'b'])
  })

  it('rejects private records and discards malformed or unsupported persisted snapshots', async () => {
    const store = createOfflineCatalog({ read: async () => null, write: async () => {} })
    expect(() => store.write([{ ...song(), source: 'personal' }])).toThrow('Only public')
    expect(() => store.upsert({ ...song(), personalId: 'private-id' })).toThrow('Only public')
    for (const raw of ['not-json', JSON.stringify({ version: 2, songs: [song()] }), JSON.stringify({ version: 1, songs: [{ ...song(), source: 'personal' }] })]) {
      expect(await createOfflineCatalog({ read: async () => raw, write: async () => {} }).read()).toEqual([])
    }
  })
})
