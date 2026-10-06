/**
 * useSongs — fetches the full song list from Supabase and normalises the rows
 * into the same shape that components previously read from src/data/index.json.
 *
 * Extra fields added by the DB:
 *   dbId          — UUID primary key (used for starring and setlist entries)
 *   star_count    — integer, maintained by DB trigger
 *   chordpro_content — full renderable body (metadata directives stripped)
 *
 * Uses a stale-while-revalidate strategy: cached data is served immediately,
 * but after STALE_MS a background refetch runs and all mounted hook instances
 * are updated without requiring a hard refresh.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STALE_MS = 5 * 60 * 1000  // revalidate after 5 minutes

let snapshot = { songs: [], loading: true, error: null }
let cacheTime = 0
let request = null
const listeners = new Set()

function publish(next) {
  snapshot = next
  listeners.forEach(listener => listener(next))
}

async function fetchSongs() {
  if (request) return request
  publish({ ...snapshot, loading: snapshot.songs.length === 0, error: null })
  request = supabase
    .from('songs')
    .select(
      'id, slug, title, artist, default_key, tempo, time_signature, tags, ' +
      'country, youtube_id, source_filename, chordpro_content, star_count, ' +
      'song_group_id, is_deleted, has_stems, stem_slug, gracetracks_url'
    )
    .eq('is_deleted', false)
    .order('title')
    .then(({ data, error }) => {
      if (error) throw error
      const songs = (data || []).map(normaliseSong)
      cacheTime = Date.now()
      publish({ songs, loading: false, error: null })
      return songs
    })
    .catch(error => {
      console.error('[useSongs] Failed to load songs from Supabase:', error)
      publish({ ...snapshot, loading: false, error })
      return snapshot.songs
    })
    .finally(() => { request = null })
  return request
}

/**
 * Map a Supabase songs row to the shape components expect.
 * Field mapping:
 *   id (UUID)       → dbId   (for FK relationships like starring)
 *   slug            → id     (URL routing, backward-compat with slug-based code)
 *   artist (string) → authors (string[])
 *   default_key     → originalKey
 *   youtube_id      → youtube (full URL or empty string)
 *   source_filename → filename (e.g. "10_000_reasons.chordpro")
 */
function normaliseSong(song) {
  return {
    // DB identity
    dbId: song.id,

    // URL / catalog identity (slug-based, backward compatible)
    id: song.slug,
    songId: song.slug,

    // Metadata
    title: song.title,
    language: 'en',  // language will be added when multi-lingual support is wired
    originalKey: song.default_key || '',
    // Setlist rows show these in their own columns and core's summarizeSet
    // derives the set's BPM range from them.
    tempo: song.tempo ?? null,
    timeSignature: song.time_signature || '',
    tags: Array.isArray(song.tags) ? song.tags : [],
    authors: song.artist
      ? song.artist.split(/,\s*/).filter(Boolean)
      : [],
    country: song.country || '',

    // Media URLs
    youtube: song.youtube_id
      ? `https://www.youtube.com/watch?v=${song.youtube_id}`
      : null,
    mp3: null,
    pptx: '',

    // Content (from DB — no static-file fetch needed in SongViewPage)
    chordpro_content: song.chordpro_content || '',

    // Source filename for pptx/JPG URL construction (may differ from slug)
    filename: song.source_filename
      ? `${song.source_filename}.chordpro`
      : `${song.slug.replace(/-/g, '_')}.chordpro`,

    // Stats
    star_count: song.star_count || 0,

    // Translation grouping (not yet wired)
    song_group_id: song.song_group_id || null,

    incomplete: false,

    // GraceTracks stem fields
    has_stems:       song.has_stems       ?? false,
    stem_slug:       song.stem_slug       ?? null,
    gracetracks_url: song.gracetracks_url ?? null,
  }
}

/**
 * Hook. Returns { songs, loading, error, retry }.
 * songs — array of normalised song objects
 * loading — true while the first fetch is in flight
 */
export function useSongs() {
  const [state, setState] = useState(snapshot)

  useEffect(() => {
    listeners.add(setState)
    setState(snapshot)
    if (snapshot.loading || (cacheTime && Date.now() - cacheTime > STALE_MS)) {
      void fetchSongs()
    }
    return () => listeners.delete(setState)
  }, [])

  return { ...state, retry: fetchSongs }
}
