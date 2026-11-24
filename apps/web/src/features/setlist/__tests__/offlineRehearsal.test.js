import { describe, it, expect, vi } from 'vitest'
import { downloadRehearsal } from '../offlineRehearsal'
import { entriesFromOffline } from '../../../pages/worshipModeModel'

const song = { id: 'song', slug: 'song', title: 'Cantamos', artist: null, default_key: 'D', tempo: 72, time_signature: '4/4' }
const body = '{title: Cantamos}\n{key: D}\n{start_of_verse}\n[D]Primera estrofa\n{end_of_verse}\n{start_of_chorus}\n[G]Coro\n{end_of_chorus}'
const catalog = { byId: new Map([['song', { ...song, chordpro_content: body }]]) }
const item = { entryKey: 'first', songId: 'song', toKey: 'E', notes: 'Entrada suave', song, sectionOrderText: '2,1,2' }
const input = { id: 'set', name: 'Domingo', serviceDate: null, updatedAt: null, items: [item] }

describe('offline rehearsal preparation and reader', () => {
  it('prepares full local charts and renders the occurrence arrangement and notes', async () => {
    const client = { from: vi.fn() }
    const snapshot = await downloadRehearsal(input, { client, catalog })
    const entries = entriesFromOffline(snapshot)
    expect(client.from).not.toHaveBeenCalled()
    expect(entries[0]).toMatchObject({ title: 'Cantamos', notes: 'Entrada suave', baseKey: 'D' })
    expect(entries[0].sections.map(section => section.lines[0].plain)).toEqual(['Coro', 'Primera estrofa', 'Coro'])
    expect(snapshot.items[0].toKey).toBe('E')
  })
  it('rejects incomplete scripture instead of marking a partial reading as downloaded', async () => {
    const scripture = { ...item, songId: 'v:esv|John 3:16-17', song: { ...song, title: 'John 3:16-17' } }
    await expect(downloadRehearsal({ ...input, items: [scripture] }, {
      client: {}, catalog, fetchChapter: async () => ({ verses: { 16: 'For God so loved the world' } }),
    })).rejects.toThrow('Incomplete scripture reading')
  })
  it('saves scripture text and preserves duplicate songs as independent appearances', async () => {
    const scripture = { ...item, entryKey: 'reading', songId: 'v:esv|John 3:16', song: { ...song, title: 'John 3:16' }, toKey: null }
    const snapshot = await downloadRehearsal({ ...input, items: [item, scripture, { ...item, entryKey: 'reprise', toKey: 'G', notes: 'Más fuerte' }] }, {
      client: {}, catalog, fetchChapter: async () => ({ verses: { 16: 'For God so loved the world' } }),
    })
    const entries = entriesFromOffline(snapshot)
    expect(entries.map(entry => entry.entryKey)).toEqual(['first', 'reading', 'reprise'])
    expect(entries[1].sections[0].lines[0].text).toContain('God')
    expect(entries[2].notes).toBe('Más fuerte')
    expect(snapshot.items.map(entry => entry.toKey)).toEqual(['E', null, 'G'])
  })
  it('refuses an arrangement referencing a missing section', async () => {
    const snapshot = await downloadRehearsal({ ...input, items: [{ ...item, sectionOrderText: '20' }] }, { client: {}, catalog })
    expect(() => entriesFromOffline(snapshot)).toThrow('Invalid rehearsal section order')
  })
})
