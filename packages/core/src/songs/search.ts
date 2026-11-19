/** Minimal song shape used by catalog and setlist pickers on every client. */
export type SearchableSong = {
  title: string
  tags?: readonly string[] | null
  artist?: string | null
}

export const SONG_TITLE_MATCH = 0
export const SONG_TAG_MATCH = 1

/** Case and accent insensitive text for user-entered catalog searches. */
export function normalizeSongQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .trim()
}

/** Title matches precede secondary matches in artist names or tags. */
export function rankSongMatch(song: SearchableSong, query: string): number | null {
  const needle = normalizeSongQuery(query)
  if (!needle) return null
  if (normalizeSongQuery(song.title).includes(needle)) return SONG_TITLE_MATCH
  if (song.artist && normalizeSongQuery(song.artist).includes(needle)) return SONG_TAG_MATCH
  for (const tag of song.tags ?? []) {
    if (normalizeSongQuery(tag).includes(needle)) return SONG_TAG_MATCH
  }
  return null
}
