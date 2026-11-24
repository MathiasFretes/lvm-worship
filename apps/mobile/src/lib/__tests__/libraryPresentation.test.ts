import { describe, expect, it } from 'vitest'
import { findLibrarySongs, makeLibrarySections } from '../libraryPresentation'
import type { Song } from '../useSongList'

const song = (title: string, extra: Partial<Song> = {}): Song => ({
  id: title, slug: title, title, artist: null, default_key: null,
  time_signature: null, tags: null, tempo: null, created_at: null, ...extra,
})

describe('mobile library model', () => {
  it('groups accented titles under their Latin letter', () => {
    const sections = makeLibrarySections([song('Ángeles'), song('Bendito')], 'title', 'asc', (k) => k)
    expect(sections.map(({ letter }) => letter)).toEqual(['A', 'B'])
  })

  it('puts title results before tag-only results', () => {
    const results = findLibrarySongs([
      song('Canto', { tags: ['adoración'] }), song('Adoración'),
    ], 'adoracion')
    expect(results.map(({ title }) => title)).toEqual(['Adoración', 'Canto'])
  })

  it('preserves newest-first ordering for recent songs', () => {
    const sections = makeLibrarySections([
      song('Vieja', { created_at: '2025-01-01' }),
      song('Nueva', { created_at: '2026-01-01' }),
    ], 'recent', 'asc', (k) => k)
    expect(sections[0].data.map(({ title }) => title)).toEqual(['Nueva', 'Vieja'])
  })

  it('finds accented artist names alongside titles and tags', () => {
    const songs = [song('Canto', { artist: 'José Pérez' }), song('José vive'), song('Otro canto')]
    expect(findLibrarySongs(songs, 'JOSE').map(item => item.title)).toEqual(['José vive', 'Canto'])
  })

  it('optionally searches lyric phrases across chords without matching ChordPro directives', () => {
    const songs = [song('Himno', { chordpro_content: '{title: Hidden directive}\n[C]Dios de [G]amor' })]
    expect(findLibrarySongs(songs, 'Dios de amor')).toEqual([])
    expect(findLibrarySongs(songs, 'DIOS DE AMOR', true)).toEqual(songs)
    expect(findLibrarySongs(songs, 'Hidden directive', true)).toEqual([])
    songs[0].chordpro_content = '[C]Otra letra'
    expect(findLibrarySongs(songs, 'Dios de amor', true)).toEqual([])
  })
})
