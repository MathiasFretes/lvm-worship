import { normalizeSongQuery, rankSongMatch } from '@lavozmisionera/core'
import type { SortDir, SortKey } from '../components/FilterSortSheet'
import type { Song } from './useSongList'

export type LibrarySection = {
  key: string
  title: string
  letter: string | null
  data: Song[]
}

function byTitle(left: Song, right: Song) {
  return left.title.localeCompare(right.title)
}

function letterOf(value: string | null | undefined) {
  const first = normalizeSongQuery(value ?? '').charAt(0).toUpperCase()
  return /^[A-Z]$/.test(first) ? first : '#'
}

/** Keeps grouping and ordering independent of the native list component. */
export function makeLibrarySections(
  songs: Song[],
  sortKey: SortKey,
  direction: SortDir,
  keyOf: (key: string) => string,
): LibrarySection[] {
  if (sortKey === 'title' || sortKey === 'artist' || sortKey === 'key') {
    const groups = new Map<string, Song[]>()
    for (const song of songs) {
      const group = sortKey === 'key'
        ? song.default_key || ''
        : letterOf(sortKey === 'artist' ? song.artist : song.title)
      groups.set(group, [...(groups.get(group) ?? []), song])
    }
    const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b))
    if (direction === 'desc') keys.reverse()
    return keys.map((key) => {
      const rows = groups.get(key)!.slice().sort((a, b) =>
        sortKey === 'artist'
          ? (a.artist ?? '').localeCompare(b.artist ?? '') || byTitle(a, b)
          : byTitle(a, b),
      )
      if (direction === 'desc' && sortKey !== 'key') rows.reverse()
      return {
        key: key || '__no_key',
        title: sortKey === 'key' ? keyOf(key) : key,
        letter: sortKey === 'key' ? null : key,
        data: rows,
      }
    })
  }

  const rows = songs.slice().sort(sortKey === 'recent'
    ? (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')
    : (a, b) => (a.tempo ?? Infinity) - (b.tempo ?? Infinity))
  if (direction === 'desc') rows.reverse()
  return rows.length ? [{ key: '__all', title: '', letter: null, data: rows }] : []
}

export function findLibrarySongs(songs: Song[], query: string): Song[] {
  if (!normalizeSongQuery(query)) return []
  return songs
    .map((song) => ({ song, rank: rankSongMatch(song, query) }))
    .filter((entry): entry is { song: Song; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || byTitle(a.song, b.song))
    .map(({ song }) => song)
}
