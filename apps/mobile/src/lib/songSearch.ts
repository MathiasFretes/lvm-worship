import { rankSongMatch, SONG_TAG_MATCH, SONG_TITLE_MATCH } from '@lavozmisionera/core'
import type { Song } from './useSongList'

// Preserve the picker API while the rule lives in shared core.
export const TITLE_MATCH = SONG_TITLE_MATCH
export const TAG_MATCH = SONG_TAG_MATCH

export function songMatchRank(song: Song, query: string): number | null {
  return rankSongMatch(song, query)
}

export function songMatchesQuery(song: Song, query: string): boolean {
  return songMatchRank(song, query) !== null
}
