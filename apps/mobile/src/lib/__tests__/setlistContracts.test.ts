import { describe, expect, it } from 'vitest'
import {
  responseFilename,
  setlistExportPayload,
  songbookExportPayload,
} from '../exportPayloads'
import { buildSetlistSharePath } from '../setlistSharePath'
import { oldestSetlistsFirst, togglePruneSelection } from '../setlistPrune'
import { buildSongPickerRows } from '../setlistSongPicker'
import {
  createSongbookDraft,
  reduceSongbookDraft,
  selectedSongbookSongs,
} from '../songbookModel'
import type { Song } from '../useSongList'

function song(id: string, title: string, tags: string[] = []): Song {
  return {
    id,
    slug: id,
    title,
    artist: null,
    default_key: null,
    time_signature: null,
    tags,
    tempo: null,
    created_at: null,
  }
}

describe('setlist picker contracts', () => {
  const songs = [song('z', 'Zion'), song('a', 'Árbol'), song('p', 'Prayer', ['adoración'])]

  it('sorts without mutating and ranks normalized matches', () => {
    const original = songs.map((item) => item.id)
    expect(buildSongPickerRows(songs, new Set(['a']), '', 'es').map((row) => row.song.id))
      .toEqual(['a', 'p', 'z'])
    expect(buildSongPickerRows(songs, new Set(), 'adoracion').map((row) => row.song.id))
      .toEqual(['p'])
    expect(songs.map((item) => item.id)).toEqual(original)
  })
})

describe('ordered export and sharing contracts', () => {
  const items = [
    { songId: 'one', key: 'D' },
    { songId: 'one', key: 'E' },
    { songId: 'v:ESV|John 3:16', key: null },
  ]

  it('preserves repetitions, order, keys, and verse ids in export payloads', () => {
    expect(setlistExportPayload(items)).toEqual({
      items: [
        { song_id: 'one', key: 'D' },
        { song_id: 'one', key: 'E' },
        { song_id: 'v:ESV|John 3:16', key: '' },
      ],
    })
    expect(songbookExportPayload({ items, includeTOC: false }).include_toc).toBe(false)
  })

  it('encodes repeated songs and falls back to songId for verses', () => {
    expect(buildSetlistSharePath([
      { songId: 'one', song: { slug: 'one' }, toKey: 'D' },
      { songId: 'one', song: { slug: 'one' }, toKey: 'E' },
      { songId: 'v:ESV|John 3:16', song: { slug: '' }, toKey: null },
    ])).toBe('/setlist/one,one,v%3AESV%7CJohn%203%3A16?toKeys=D,E,')
  })

  it('accepts UTF-8 filenames and strips server paths', () => {
    expect(responseFilename("attachment; filename*=UTF-8''repertorio%20domingo.pdf", 'x.pdf'))
      .toBe('repertorio domingo.pdf')
    expect(responseFilename('attachment; filename="../unsafe.pdf"', 'x.pdf')).toBe('unsafe.pdf')
  })
})

describe('songbook draft', () => {
  it('keeps selection independent and exports it alphabetically', () => {
    const initial = createSongbookDraft('Book', 'Date')
    const withZ = reduceSongbookDraft(initial, { type: 'toggleSong', id: 'z' })
    const withBoth = reduceSongbookDraft(withZ, { type: 'toggleSong', id: 'a' })

    expect(initial.selectedIds.size).toBe(0)
    expect(selectedSongbookSongs([song('z', 'Zion'), song('a', 'Árbol')], withBoth.selectedIds, 'es')
      .map((item) => item.id)).toEqual(['a', 'z'])
  })
})

describe('setlist pruning', () => {
  it('orders oldest first without mutating and toggles immutable selections', () => {
    const rows = [
      { id: 'new', created_at: '2026-10-07T10:00:00Z' },
      { id: 'old', created_at: '2025-01-01T10:00:00Z' },
    ]
    expect(oldestSetlistsFirst(rows).map((row) => row.id)).toEqual(['old', 'new'])
    expect(rows.map((row) => row.id)).toEqual(['new', 'old'])

    const selected = new Set(['old'])
    expect([...togglePruneSelection(selected, 'old')]).toEqual([])
    expect([...selected]).toEqual(['old'])
  })
})
