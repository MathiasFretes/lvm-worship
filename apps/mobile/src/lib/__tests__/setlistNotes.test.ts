import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { duplicateSetlist, updateSetlist } from '../../../../../packages/core/src/setlists/setlistsRepo.js'

function repositoryFixture() {
  const inserted: Record<string, unknown>[][] = []
  const source = {
    id: 'original', name: 'Sunday', service_date: '2026-11-22', updated_at: '',
    setlist_songs: [
      { id: 'a', song_id: 'song', position: 0, key_override: 'D', notes: 'Quiet intro' },
      { id: 'b', personal_song_id: 'draft', position: 1, notes: 'Solo voice' },
      { id: 'c', verse_ref: 'v:ESV|John 3:16', position: 2, notes: 'Read together' },
      { id: 'd', song_id: 'song', position: 3, key_override: 'E', notes: 'Repeat chorus' },
    ],
  }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    from(table: string) {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: source }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
        insert(rows: unknown) {
          if (table === 'setlist_songs') {
            inserted.push(rows as Record<string, unknown>[])
            return Promise.resolve({ error: null })
          }
          return { select: () => ({ single: async () => ({ data: { id: 'copy' } }) }) }
        },
      }
    },
  }
  return { client: client as unknown as SupabaseClient, inserted }
}

describe('setlist occurrence notes', () => {
  it('retains different notes on repeated songs through wipe-and-replace saves', async () => {
    const { client, inserted } = repositoryFixture()
    await updateSetlist(client, 'set', { songs: [
      { id: 'song', toKey: 'D', notes: 'Intro' },
      { id: 'song', toKey: 'E', notes: 'Final chorus' },
      { id: 'other' },
    ] })
    expect(inserted[0].map(row => [row.song_id, row.position, row.key_override, row.notes]))
      .toEqual([['song', 0, 'D', 'Intro'], ['song', 1, 'E', 'Final chorus'], ['other', 2, null, null]])
  })

  it('copies notes, order and keys for catalog songs, personal songs and readings', async () => {
    const { client, inserted } = repositoryFixture()
    await duplicateSetlist(client, 'original', 'Sunday copy')
    expect(inserted[0]).toEqual([
      { setlist_id: 'copy', position: 0, song_id: 'song', key_override: 'D', notes: 'Quiet intro' },
      { setlist_id: 'copy', position: 1, personal_song_id: 'draft', key_override: null, notes: 'Solo voice' },
      { setlist_id: 'copy', position: 2, verse_ref: 'v:ESV|John 3:16', key_override: null, notes: 'Read together' },
      { setlist_id: 'copy', position: 3, song_id: 'song', key_override: 'E', notes: 'Repeat chorus' },
    ])
  })
})
