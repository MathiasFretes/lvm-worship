import { describe, expect, it } from 'vitest'
import { mergeSongCatalog } from '../songCatalogModel'

const catalogSong = {
  id: 'published-1', slug: 'santo', title: 'Santo', artist: null,
  default_key: 'G', time_signature: null, tags: ['adoración'], tempo: null, created_at: null,
}

describe('mergeSongCatalog', () => {
  it('retains drafts and hides their published twins', () => {
    const songs = mergeSongCatalog([catalogSong], [
      { ...catalogSong, id: 'draft-1', slug: null, status: 'draft', published_song_id: null },
      { ...catalogSong, id: 'draft-2', status: 'published', published_song_id: 'published-1' },
    ])
    expect(songs.map((song) => [song.id, song.source])).toEqual([
      ['personal:draft-1', 'personal'], ['published-1', 'catalog'],
    ])
    expect(songs[0].personalId).toBe('draft-1')
    expect(songs[0].slug).toBe('')
  })
})
