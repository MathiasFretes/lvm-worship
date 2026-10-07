import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import '../styles/admin-portal.css'
import '../styles/editor.css'

export default function EditorPage() {
  const { profile, role } = useAuth()

  return (
    <div className="lvm-portal-page container">
      <Helmet><title>Editor Portal – La Voz Misionera</title></Helmet>

      <h1>Editor Portal</h1>
      <p className="lvm-portal-page__subtitle">
        Welcome, {profile?.display_name || 'Editor'}. Use this portal to manage songs.
      </p>

      <section className="lvm-portal-section">
        <h2>Editor Tools</h2>
        <p style={{ color: 'var(--lvm-text-secondary)', fontSize: 'var(--lvm-font-sub)', margin: 0 }}>
          As an <strong>Editor</strong>, you can add and edit songs directly,
          approve or reject submitted suggestions, and request deletions.
        </p>
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link to="/songs" className="lvm-btn lvm-btn--primary">
            Browse Songs
          </Link>
        </div>
      </section>
    </div>
  )
}
