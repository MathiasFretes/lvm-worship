import type { Song } from './useSongList'

type CatalogRow = Omit<Song, 'source' | 'personalId' | 'reviewStatus'>
type PersonalRow = {
  id: string
  slug: string | null
  title: string
  artist: string | null
  default_key: string | null
  time_signature: string | null
  tags: string[] | null
  tempo: number | null
  status: string
  published_song_id: string | null
  created_at: string | null
}

/** Personal drafts remain distinct from published catalog entries. */
export function mergeSongCatalog(catalog: CatalogRow[], personal: PersonalRow[]): Song[] {
  const drafts: Song[] = personal
    .filter((entry) => !entry.published_song_id)
    .map((entry) => ({
      id: `personal:${entry.id}`,
      slug: entry.slug ?? '',
      title: entry.title,
      artist: entry.artist,
      default_key: entry.default_key,
      time_signature: entry.time_signature,
      tags: entry.tags,
      tempo: entry.tempo,
      created_at: entry.created_at,
      source: 'personal',
      personalId: entry.id,
      reviewStatus: entry.status,
    }))

  return [...drafts, ...catalog.map((entry): Song => ({ ...entry, source: 'catalog' }))]
}
