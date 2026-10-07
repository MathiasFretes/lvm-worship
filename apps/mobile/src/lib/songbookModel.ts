import type { Song } from './useSongList'

export type SongbookDraft = {
  selectedIds: Set<string>
  title: string
  subtitle: string
  includeTOC: boolean
  coverImageDataUrl: string | null
  coverName: string | null
}

export type SongbookAction =
  | { type: 'toggleSong'; id: string }
  | { type: 'title'; value: string }
  | { type: 'subtitle'; value: string }
  | { type: 'includeTOC'; value: boolean }
  | { type: 'cover'; dataUrl: string; name: string }
  | { type: 'clearCover' }

export function createSongbookDraft(title: string, subtitle: string): SongbookDraft {
  return {
    selectedIds: new Set(),
    title,
    subtitle,
    includeTOC: true,
    coverImageDataUrl: null,
    coverName: null,
  }
}

export function reduceSongbookDraft(
  state: SongbookDraft,
  action: SongbookAction,
): SongbookDraft {
  switch (action.type) {
    case 'toggleSong': {
      const selectedIds = new Set(state.selectedIds)
      if (selectedIds.has(action.id)) selectedIds.delete(action.id)
      else selectedIds.add(action.id)
      return { ...state, selectedIds }
    }
    case 'title':
      return { ...state, title: action.value }
    case 'subtitle':
      return { ...state, subtitle: action.value }
    case 'includeTOC':
      return { ...state, includeTOC: action.value }
    case 'cover':
      return { ...state, coverImageDataUrl: action.dataUrl, coverName: action.name }
    case 'clearCover':
      return { ...state, coverImageDataUrl: null, coverName: null }
  }
}

export function selectedSongbookSongs(
  songs: readonly Song[],
  selectedIds: ReadonlySet<string>,
  locale?: string,
): Song[] {
  return songs
    .filter((song) => selectedIds.has(song.id))
    .sort((a, b) => a.title.localeCompare(b.title, locale, { sensitivity: 'base' }))
}
