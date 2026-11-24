import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSongList, fetchPersonalSongs } from '@lavozmisionera/core'
import { supabase } from './supabase'
import { reportFailure } from './errors'
import { mergeSongCatalog } from './songCatalogModel'
import { offlineCatalog } from './offlineCatalog'
import { useCurrentUser } from './currentUser'

// i18n key for the user-facing failure. The hook owns it because the hook knows
// which surface it feeds; the screen renders it through its own `t`. Never the
// raw error — see errors.ts.
const LOAD_ERROR_KEY = 'errors:load.songs'

// Include the public chart so lyric search and the persistent offline catalog
// use the same snapshot as the library metadata.
//
// The library merges two sources: the public catalog (`songs`) and the signed-in
// user's own personal drafts (`personal_songs`, owner-scoped by RLS). Personal
// rows carry `source: 'personal'`, a `personalId`, and `reviewStatus` so the row
// can show Personal/Pending badges and open the viewer against the right table.
export type SongSource = 'catalog' | 'personal'

export type Song = {
  id: string
  slug: string
  title: string
  artist: string | null
  default_key: string | null
  time_signature: string | null
  tags: string[] | null
  tempo: number | null
  created_at: string | null
  chordpro_content?: string | null
  /** 'catalog' (default when omitted) or 'personal'. */
  source?: SongSource
  /** personal_songs.id when source === 'personal'. */
  personalId?: string
  /** personal_songs.status ('draft' | 'submitted' | 'published' | 'archived'). */
  reviewStatus?: string
}

const COLUMNS =
  'id, slug, title, artist, default_key, time_signature, tags, tempo, created_at, chordpro_content'

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
  chordpro_content?: string | null
}

// Fetch the public catalog and the user's personal drafts and merge them. A
// personal draft that has already been published (published_song_id set) is
// hidden — its catalog twin already appears.
export function useSongList() {
  const userId = useCurrentUser()?.id
  const cancel = useRef<(() => void) | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loadedFor, setLoadedFor] = useState(userId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [cacheError, setCacheError] = useState(false)

  const load = useCallback(() => {
    cancel.current?.()
    let alive = true
    cancel.current = () => { alive = false }
    setLoading(true)
    setError(null)
    setSongs(rows => rows.filter(row => row.source !== 'personal'))
    void (async () => {
      const cached = await offlineCatalog.read()
      if (!alive) return
      if (cached.length) { setSongs(cached); setLoading(false) }
      try {
        const [catalog, personal] = await Promise.all([
          fetchSongList(supabase, { columns: COLUMNS }) as unknown as Promise<CatalogRow[]>,
          (userId ? fetchPersonalSongs(supabase) as unknown as Promise<PersonalRow[]> : Promise.resolve([])).catch(() => [] as PersonalRow[]),
        ])
        if (!alive) return
        setSongs(mergeSongCatalog(catalog, personal))
        setLoadedFor(userId)
        setError(null)
        setOffline(false)
        try { await offlineCatalog.write(catalog); if (alive) setCacheError(false) }
        catch { if (alive) setCacheError(true) }
      } catch (err: unknown) {
        if (!alive) return
        if (cached.length) { setOffline(true); setError(null) }
        else if (reportFailure('useSongList', err)) setError(LOAD_ERROR_KEY)
      } finally {
        if (alive) setLoading(false)
      }
    })()
  }, [userId])

  useEffect(() => { load(); return () => cancel.current?.() }, [load])

  return { songs: loadedFor === userId ? songs : songs.filter(row => row.source !== 'personal'), loading, error, reload: load, offline, cacheError }
}
