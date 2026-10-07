import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../styles/auth.css'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    // VITE_SITE_URL should be set in your .env file (e.g. VITE_SITE_URL=https://lavozmisionera.com)
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    })
    // Always show the generic confirmation — do not reveal whether the email exists
    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="lvm-auth-page">
        <div className="lvm-auth-card">
          <img
            src="/lvm-mark.svg"
            alt="La Voz Misionera"
            className="lvm-auth-card__wordmark"
          />
          <h1 className="lvm-auth-card__title">Check your email</h1>
          <p className="lvm-auth-card__subtitle" style={{ marginBottom: 0 }}>
            If an account exists with that email, you'll receive a reset link shortly.
            Check your spam folder if it doesn't arrive within a few minutes.
          </p>
          <p className="lvm-auth-card__footer">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="lvm-auth-page">
      <div className="lvm-auth-card">
        <img
          src="/lvm-mark.svg"
          alt="La Voz Misionera"
          className="lvm-auth-card__wordmark"
        />
        <h1 className="lvm-auth-card__title">Forgot password</h1>
        <p className="lvm-auth-card__subtitle">
          Enter your email and we'll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="lvm-auth-form">
          <div className="lvm-form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={submitting}
            />
          </div>
          <button
            type="submit"
            className="lvm-btn lvm-btn--primary"
            disabled={submitting}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="lvm-auth-card__footer">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
