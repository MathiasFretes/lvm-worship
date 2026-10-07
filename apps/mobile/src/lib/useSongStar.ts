import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

// Per-song favorite toggle backed by `user_starred_songs` (uuid FK to
// songs.id, RLS-scoped to the signed-in user). Reads the star state for one
// song and writes optimistically: the UI flips immediately and reverts if the
// insert/delete fails. Complements the read-only `useStarredSongs` list.
export function useSongStar(songId: string | undefined) {
  const [starred, setStarred] = useState(false)
  const [ready, setReady] = useState(false)
  const starredRef = useRef(false)

  const commitStarred = useCallback((value: boolean) => {
    starredRef.current = value
    setStarred(value)
  }, [])

  useEffect(() => {
    if (!songId) {
      setReady(false)
      commitStarred(false)
      return
    }
    setReady(false)
    commitStarred(false)
    let alive = true
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const uid = sessionData.session?.user?.id
        if (!uid) return
        const { data } = await supabase
          .from('user_starred_songs')
          .select('song_id')
          .eq('user_id', uid)
          .eq('song_id', songId)
          .maybeSingle()
        if (alive) commitStarred(Boolean(data))
      } catch {
        // Non-fatal: leave as not-starred; toggle will still try to write.
      } finally {
        if (alive) setReady(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [songId, commitStarred])

  const toggle = useCallback(async () => {
    if (!songId) return
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user?.id
    if (!uid) return
    const previous = starredRef.current
    const next = !previous
    commitStarred(next) // optimistic
    try {
      if (next) {
        const { error } = await supabase
          .from('user_starred_songs')
          .upsert({ user_id: uid, song_id: songId }, { onConflict: 'user_id,song_id' })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('user_starred_songs')
          .delete()
          .eq('user_id', uid)
          .eq('song_id', songId)
        if (error) throw error
      }
    } catch {
      if (starredRef.current === next) commitStarred(previous)
    }
  }, [songId, commitStarred])

  return { starred, ready, toggle }
}
