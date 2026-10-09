import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { showToast } from '../../utils/app/toast'

export default function StarButton({ songId }) {
  const { isLoggedIn, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [starred, setStarred] = useState(false)
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)

  const userId = session?.user?.id

  useEffect(() => {
    if (loading) return // wait for auth to resolve before doing anything
    // songId is the UUID from the songs table (set after useSongs() resolves)
    if (!isLoggedIn || !userId || !songId) {
      setChecking(false)
      return
    }
    // Rapid navigation between songs can stack in-flight queries; ignore any
    // response whose deps have already changed to avoid setState-after-unmount
    // and stale starred-flag flicker.
    let cancelled = false
    setChecking(true)
    supabase
      .from('user_starred_songs')
      .select('song_id')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error) setStarred(Boolean(data))
        setChecking(false)
      })
    return () => { cancelled = true }
  }, [loading, isLoggedIn, userId, songId])

  async function handleClick() {
    if (!isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)
      return
    }
    if (saving || checking || !userId || !songId) return
    const wasStarred = starred
    setSaving(true)
    setStarred(!wasStarred) // optimistic update
    try {
      if (wasStarred) {
        const { error } = await supabase
          .from('user_starred_songs')
          .delete()
          .eq('user_id', userId)
          .eq('song_id', songId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('user_starred_songs')
          .insert({ user_id: userId, song_id: songId })
        if (error) throw error
      }
    } catch (error) {
      console.error(`Failed to ${wasStarred ? 'unstar' : 'star'} song:`, error)
      setStarred(wasStarred)
      showToast(wasStarred
        ? 'Could not remove star. Please try again.'
        : 'Could not star song. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      className={`lvm-star-btn${starred ? ' starred' : ''}`}
      onClick={handleClick}
      aria-label={starred ? 'Unstar song' : 'Star song'}
      aria-pressed={starred}
      disabled={checking || saving}
      title={starred ? 'Remove from starred' : 'Star this song'}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
  )
}
