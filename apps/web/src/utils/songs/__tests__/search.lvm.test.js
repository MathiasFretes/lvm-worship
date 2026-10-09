import { describe, expect, it } from 'vitest'
import { normalizeSongSearch, searchSongs } from '../search'

const songs = [
  { id: '1', title: 'Niño de Belén', tags: ['Navidad'], authors: ['José Pérez'] },
  { id: '2', title: 'Coração', tags: ['Adoração'], authors: ['Ana'] },
  { id: '3', title: '찬양', tags: [], authors: [] },
]

describe('LVM song search', () => {
  it('matches titles, tags and authors without requiring accent marks', () => {
    expect(searchSongs(songs, 'nino')[0].item.id).toBe('1')
    expect(searchSongs(songs, 'coracao')[0].item.id).toBe('2')
    expect(searchSongs(songs, 'perez')[0].item.id).toBe('1')
  })

  it('keeps non-Latin letters searchable and ignores internal substrings', () => {
    expect(searchSongs(songs, '찬양')[0].item.id).toBe('3')
    expect(searchSongs(songs, 'raz')).toEqual([])
    expect(normalizeSongSearch('Ñandú — CORAÇÃO')).toBe('nandu coracao')
  })
})
