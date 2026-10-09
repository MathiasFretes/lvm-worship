import { songMatchRank } from './songSearch'
import type { Song } from './useSongList'

export type SongPickerRow = {
  song: Song
  selected: boolean
}

function compareSongs(a: Song, b: Song, locale?: string): number {
  const title = a.title.localeCompare(b.title, locale, { sensitivity: 'base' })
  if (title !== 0) return title
  return a.id.localeCompare(b.id)
}

/**
 * Shared projection for every setlist-like song picker. It keeps selection
 * outside the catalog objects, ranks search matches, and returns a new array
 * so callers can safely use catalog state as their source of truth.
 */
export function buildSongPickerRows(
  songs: readonly Song[],
  selectedIds: ReadonlySet<string>,
  query: string,
  locale?: string,
): SongPickerRow[] {
  const normalized = query.trim().toLocaleLowerCase(locale)
  if (!normalized) {
    return songs
      .slice()
      .sort((a, b) => compareSongs(a, b, locale))
      .map((song) => ({ song, selected: selectedIds.has(song.id) }))
  }

  return songs
    .map((song) => ({ song, rank: songMatchRank(song, normalized) }))
    .filter((candidate): candidate is { song: Song; rank: number } => candidate.rank != null)
    .sort((a, b) => a.rank - b.rank || compareSongs(a.song, b.song, locale))
    .map(({ song }) => ({ song, selected: selectedIds.has(song.id) }))
}

export function toggledSongIds(current: ReadonlySet<string>, songId: string): Set<string> {
  const next = new Set(current)
  if (next.has(songId)) next.delete(songId)
  else next.add(songId)
  return next
}
