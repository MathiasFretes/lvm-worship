import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import '../styles/auth.css'

export default function ActivateAccountPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [token] = useState(() => {
    const value = window.location.hash.slice(1)
    window.history.replaceState(null, '', window.location.pathname)
    return value
  })
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    const result = await supabase.auth.activate({ token, password })
    setBusy(false)
    if (result.error) setError(result.error.message)
    else navigate('/app', { replace: true })
  }
  return <div className="lvm-auth-page"><div className="lvm-auth-card">
    <img src="/lvm-mark.svg" alt="La Voz Misionera" className="lvm-auth-card__wordmark" />
    <h1 className="lvm-auth-card__title">{t('welcomeBack')}</h1>
    <form onSubmit={submit} className="lvm-auth-form">
      {error && <div role="alert" className="lvm-auth-error">{error}</div>}
      <div className="lvm-form-field"><label htmlFor="activation-password">{t('password')}</label>
        <input id="activation-password" type="password" minLength={8} maxLength={256} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} />
      </div>
      <button type="submit" className="btn" disabled={busy || !token}>{t('signIn')}</button>
    </form>
  </div></div>
}
