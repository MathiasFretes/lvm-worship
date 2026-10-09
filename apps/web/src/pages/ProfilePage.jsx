import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import SpritePicker from '../components/ui/SpritePicker'
import SpriteAvatar from '../components/ui/SpriteAvatar'
import LanguageSelector from '../components/ui/LanguageSelector'
import { showToast } from '../utils/app/toast'
import '../styles/settings.css'
// src/data/index.json is deprecated as a songs source; starred songs are now joined from Supabase.

export default function ProfilePage() {
  const { t } = useTranslation('profile')
  const { session, profile, loading, isLoggedIn, refreshProfile, role, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [displayName, setDisplayName] = useState('')
  const [sprite, setSprite] = useState(null)
  const [saving, setSaving] = useState(false)

  // Each item: { song_id: UUID, songs: { slug, title, default_key, artist } }
  const [starredItems, setStarredItems] = useState([])
  const [starsLoading, setStarsLoading] = useState(true)


  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Whether this account can sign in with an email + password. OAuth-only
  // accounts (Google / Apple) have no password to confirm, so the delete flow
  // falls back to a typed confirmation for them.
  const hasPasswordLogin =
    (session?.user?.identities || []).some(i => i.provider === 'email') ||
    (session?.user?.app_metadata?.providers || []).includes('email') ||
    session?.user?.app_metadata?.provider === 'email'

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate('/login?redirect=/profile', { replace: true })
    }
  }, [isLoggedIn, loading, navigate])

  // Scroll to anchor when the route hash points at a section on this page
  useEffect(() => {
    if (loading) return
    const hash = (location.hash || '').replace(/^#/, '')
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, location.hash])

  // Sync form state from profile
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setSprite(profile.preferences?.sprite || null)
    }
  }, [profile])

  // Fetch starred songs
  useEffect(() => {
    if (!session) return
    let cancelled = false

    // Join with songs to get slug, title, key, artist in one query.
    supabase
      .from('user_starred_songs')
      .select('song_id, songs!inner(slug, title, default_key, artist)')
      .eq('user_id', session.user.id)
      .order('songs(title)')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('[ProfilePage] Failed to load starred songs:', error)
        setStarredItems(data || [])
        setStarsLoading(false)
      })

    return () => { cancelled = true }
  }, [session])

  async function saveProfile() {
    setSaving(true)
    const { error } = await supabase
      .from('users')
      .update({
        display_name: displayName,
        preferences: { ...(profile?.preferences || {}), sprite },
      })
      .eq('id', session.user.id)
    if (error) showToast(t('saveFailed'))
    else {
      await refreshProfile()
      showToast('Profile saved.')
    }
    setSaving(false)
  }

  async function unstarSong(songId) {
    // songId is the UUID from songs.id
    const removed = starredItems.find(item => item.song_id === songId)
    setStarredItems(prev => prev.filter(item => item.song_id !== songId))
    const { error } = await supabase
      .from('user_starred_songs')
      .delete()
      .eq('user_id', session.user.id)
      .eq('song_id', songId)
    if (error) {
      console.error('[ProfilePage] Failed to unstar song:', error)
      showToast('Could not remove star. Please try again.')
      if (removed) setStarredItems(prev => [...prev, removed]) // revert on error
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  async function deleteAccount() {
    setDeleteError('')
    setDeleting(true)
    // Verify password before deletion for password accounts. OAuth-only accounts
    // have no password, so the modal requires typing "DELETE" instead.
    if (hasPasswordLogin) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: deletePassword,
      })
      if (authError) {
        setDeleteError('Incorrect password. Please try again.')
        setDeleting(false)
        return
      }
    }
    // Delete account via RPC (SECURITY DEFINER function removes from auth.users + cascades)
    const { error: deleteError } = await supabase.rpc('delete_user')
    if (deleteError) {
      setDeleteError('Failed to delete account. Please try again.')
      setDeleting(false)
      return
    }
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading || !profile) {
    return (
      <div className="container">
        <p style={{ padding: '32px 0', color: 'var(--lvm-text-secondary)' }}>Loading…</p>
      </div>
    )
  }

  const currentSprite = sprite || 'music-note'
  const roleBadge = role !== 'user' ? role : null

  return (
    <div className="container">
      <Helmet><title>Profile – La Voz Misionera</title></Helmet>

      {/* Profile header */}
      <div className="lvm-profile-header">
        <SpriteAvatar sprite={currentSprite} size="lg" />
        <div>
          <h1 style={{ margin: 0 }}>{profile.display_name || 'Your Profile'}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--lvm-text-secondary)', fontSize: 'var(--lvm-font-sub)' }}>
            {session.user.email}
          </p>
        </div>
      </div>

      {/* Identity section */}
      <section className="lvm-profile-section">
        <h2>Identity</h2>
        <div className="lvm-form-field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
        </div>
        <div className="lvm-form-field">
          <label>Email</label>
          <input type="email" value={session.user.email} disabled readOnly />
        </div>
        <div className="lvm-form-field">
          <label>Your icon</label>
          <SpritePicker value={sprite} onChange={setSprite} />
        </div>
        <button
          className="lvm-btn lvm-btn--primary"
          onClick={saveProfile}
          disabled={saving}
          style={{ width: 'fit-content' }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </section>

      {/* Preferences section */}
      <section className="lvm-profile-section">
        <h2>{t('preferences')}</h2>
        <div className="lvm-form-field">
          <label htmlFor="ui-language">{t('uiLanguage')}</label>
          <LanguageSelector id="ui-language" style={{ maxWidth: 240 }} />
          <p style={{ fontSize: 13, color: 'var(--lvm-text-secondary)', marginTop: 4 }}>
            {t('uiLanguageHelper')}
          </p>
        </div>
      </section>

      {/* Starred songs section */}
      <section className="lvm-profile-section">
        <h2>Starred Songs</h2>
        {starsLoading ? (
          <p style={{ color: 'var(--lvm-text-secondary)' }}>Loading…</p>
        ) : starredItems.length === 0 ? (
          <p style={{ color: 'var(--lvm-text-secondary)' }}>
            No starred songs yet. Star songs from the song page to find them here.
          </p>
        ) : (
          <div className="lvm-starred-list">
            {starredItems.map(item => {
              const { song_id, songs: song } = item
              return (
                <div key={song_id} className="lvm-starred-row">
                  <Link to={`/songs/${song?.slug || song_id}`} className="lvm-starred-row__info">
                    <span className="lvm-starred-row__title">{song?.title || song_id}</span>
                    {song?.default_key && <span className="lvm-starred-row__key">{song.default_key}</span>}
                    {song?.artist && <span className="lvm-starred-row__artist">{song.artist}</span>}
                  </Link>
                  <button
                    className="lvm-btn lvm-btn--ghost lvm-btn--sm"
                    onClick={() => unstarSong(song_id)}
                    aria-label={`Unstar ${song?.title || song_id}`}
                  >
                    Unstar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Account section */}
      <section className="lvm-profile-section">
        <h2>Account</h2>
        {roleBadge && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div className="lvm-role-badge">
              {roleBadge.charAt(0).toUpperCase() + roleBadge.slice(1)}
            </div>
            {isAdmin && (
              <Link to="/admin" className="lvm-btn lvm-btn--ghost lvm-btn--sm">
                Admin Portal →
              </Link>
            )}
          </div>
        )}
        <button
          className="lvm-btn lvm-btn--ghost"
          onClick={signOut}
          style={{ width: 'fit-content', marginTop: 8 }}
        >
          Sign out
        </button>

        <div className="lvm-danger-zone">
          <div>
            <p className="lvm-danger-zone__label">Delete account</p>
            <p className="lvm-danger-zone__description">
              Permanently remove your account and all associated data. This cannot be undone.
            </p>
          </div>
          <button
            className="lvm-btn lvm-btn--danger"
            onClick={() => { setDeletePassword(''); setDeleteConfirmText(''); setDeleteError(''); setShowDeleteModal(true) }}
            style={{ width: 'fit-content', flexShrink: 0 }}
          >
            Delete account
          </button>
        </div>
      </section>

      {/* Delete account modal */}
      {showDeleteModal && (
        <div className="lvm-modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="lvm-modal" onClick={e => e.stopPropagation()}>
            <h2>Delete account</h2>
            <p style={{ margin: 0, color: 'var(--lvm-text-secondary)', fontSize: 'var(--lvm-font-sub)' }}>
              This will permanently delete your account and all your data, including starred songs,
              setlists and reflections. <strong style={{ color: 'var(--lvm-danger)' }}>This cannot be undone.</strong>
            </p>
            {hasPasswordLogin ? (
              <div className="lvm-form-field">
                <label htmlFor="deletePassword">Confirm your password</label>
                <input
                  id="deletePassword"
                  type="password"
                  value={deletePassword}
                  onChange={e => { setDeletePassword(e.target.value); setDeleteError('') }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={deleting}
                />
              </div>
            ) : (
              <div className="lvm-form-field">
                <label htmlFor="deleteConfirmText">Type DELETE to confirm</label>
                <input
                  id="deleteConfirmText"
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => { setDeleteConfirmText(e.target.value); setDeleteError('') }}
                  placeholder="DELETE"
                  autoComplete="off"
                  disabled={deleting}
                />
              </div>
            )}
            {deleteError && (
              <p className="lvm-auth-error" style={{ margin: 0 }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="lvm-btn lvm-btn--danger"
                onClick={deleteAccount}
                disabled={
                  deleting ||
                  (hasPasswordLogin
                    ? !deletePassword
                    : deleteConfirmText.trim().toUpperCase() !== 'DELETE')
                }
              >
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
              <button
                className="lvm-btn lvm-btn--ghost"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
