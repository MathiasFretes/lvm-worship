export type ShareableSetlistItem = {
  songId?: string
  song: { slug: string }
  toKey: string | null
}

/** Build the relative web contract while retaining order and repeated entries. */
export function buildSetlistSharePath(items: readonly ShareableSetlistItem[]): string {
  const ids = items
    .map((item) => encodeURIComponent(item.song.slug || item.songId || ''))
    .join(',')
  const keys = items.map((item) => encodeURIComponent(item.toKey ?? '')).join(',')
  return `/setlist/${ids}?toKeys=${keys}`
}
