import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GearIcon, LogOutIcon } from '../Icons'
import OfflineBadge from '../OfflineBadge'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import SettingsCluster from './SettingsCluster'
import SpriteAvatar from './SpriteAvatar'
import './worship-navigation.css'

type Destination = {
  to: string
  label: string
  active: (path: string) => boolean
}

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

export default function WorshipNavigation() {
  const { t } = useTranslation(['nav', 'common'])
  const { pathname } = useLocation()
  const { isLoggedIn, loading, session, profile, hasMinRole } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [popover, setPopover] = useState<'settings' | 'account' | null>(null)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)

  const setlistHome = isLoggedIn ? '/setlists' : '/setlist'
  const destinations: Destination[] = [
    { to: '/', label: t('home'), active: path => path === '/' },
    { to: '/songs', label: t('songs'), active: path => matches(path, '/songs') || matches(path, '/song') },
    { to: setlistHome, label: t('setlist'), active: path => matches(path, '/setlist') || matches(path, '/setlists') || matches(path, '/set') },
    { to: '/songbook', label: t('songbook'), active: path => matches(path, '/songbook') },
    { to: '/reading', label: t('dailyWord'), active: path => matches(path, '/reading') },
  ]

  useEffect(() => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    setPortalHost(host)
    return () => host.remove()
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
    setPopover(null)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>('a, button, select')?.focus())
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer()
        return
      }
      if (event.key !== 'Tab' || !drawerRef.current) return
      const controls = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), select'))
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || !drawerRef.current.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [drawerOpen])

  useEffect(() => {
    if (!popover) return
    function onPointerDown(event: PointerEvent) {
      const host = popover === 'settings' ? settingsRef.current : accountRef.current
      if (host && !host.contains(event.target as Node)) setPopover(null)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPopover(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [popover])

  function closeDrawer() {
    setDrawerOpen(false)
    triggerRef.current?.focus()
  }

  async function signOut() {
    setPopover(null)
    setDrawerOpen(false)
    await supabase.auth.signOut()
  }

  function navLinks(closeOnSelect = false) {
    return destinations.map(({ to, label, active }) => (
      <Link
        key={to}
        to={to}
        className="lvm-worship-nav__link"
        aria-current={active(pathname) ? 'page' : undefined}
        onClick={closeOnSelect ? closeDrawer : undefined}
      >
        {label}
      </Link>
    ))
  }

  return (
    <>
      <header className="lvm-worship-nav">
        <div className="lvm-worship-nav__bar">
          <Link to="/" className="lvm-worship-nav__brand" aria-label={t('laVozMisioneraHome')}>
            <span className="lvm-worship-nav__brand-mark" aria-hidden="true" />
            <span className="lvm-worship-nav__brand-copy">
              <strong>La Voz <span>Misionera</span></strong>
              <small>Worship</small>
            </span>
          </Link>
          <nav className="lvm-worship-nav__desktop" aria-label={t('mainNavigation')}>
            {navLinks()}
            {isLoggedIn && hasMinRole('editor') && !hasMinRole('admin') && <Link to="/editor" className="lvm-worship-nav__link" aria-current={matches(pathname, '/editor') ? 'page' : undefined}>{t('editorPortal')}</Link>}
          </nav>
          <div className="lvm-worship-nav__actions">
            <div className="lvm-worship-nav__popover-host" ref={settingsRef}>
              <button
                type="button"
                className="lvm-worship-nav__icon-button"
                aria-label={t('common:settings')}
                aria-expanded={popover === 'settings'}
                onClick={() => setPopover(value => value === 'settings' ? null : 'settings')}
              >
                <GearIcon />
              </button>
              {popover === 'settings' && <div className="lvm-worship-nav__popover"><SettingsCluster orientation="column" /></div>}
            </div>
            {!loading && (isLoggedIn ? (
              <div className="lvm-worship-nav__popover-host" ref={accountRef}>
                <button type="button" className="lvm-worship-nav__icon-button" aria-label={t('userMenu')} aria-expanded={popover === 'account'} onClick={() => setPopover(value => value === 'account' ? null : 'account')}>
                  <SpriteAvatar sprite={profile?.preferences?.sprite} size="sm" />
                </button>
                {popover === 'account' && <div className="lvm-worship-nav__popover lvm-worship-nav__account">
                  <p>{profile?.display_name || session?.user?.email}</p>
                  <Link to="/profile" onClick={() => setPopover(null)}>{t('profile')}</Link>
                  {hasMinRole('user') && <Link to="/portal/editor" onClick={() => setPopover(null)}>{t('songEditor')}</Link>}
                  {hasMinRole('admin') && <Link to="/admin" onClick={() => setPopover(null)}>{t('adminPortal')}</Link>}
                  <button type="button" onClick={signOut}><LogOutIcon />{t('signOut')}</button>
                </div>}
              </div>
            ) : <Link to="/login" className="lvm-worship-nav__sign-in">{t('signIn')}</Link>)}
          </div>
          <button ref={triggerRef} type="button" className="lvm-worship-nav__menu-button" aria-label={t('openMainMenu')} aria-expanded={drawerOpen} aria-controls="lvm-worship-mobile-nav" onClick={() => setDrawerOpen(value => !value)}>
            <span aria-hidden="true">☰</span>
          </button>
        </div>
      </header>
      {portalHost && drawerOpen && createPortal(
        <div className="lvm-worship-nav__drawer-layer" id="lvm-worship-mobile-nav">
          <button type="button" className="lvm-worship-nav__backdrop" aria-label={t('closeMainMenu')} onClick={closeDrawer} />
          <aside ref={drawerRef} className="lvm-worship-nav__drawer" role="dialog" aria-modal="true" aria-label={t('mobileMenu')}>
            <div className="lvm-worship-nav__drawer-header">
              <strong>LVM Worship</strong>
              <button type="button" onClick={closeDrawer} aria-label={t('closeMainMenu')}>×</button>
            </div>
            <nav className="lvm-worship-nav__drawer-links" aria-label={t('mobileMenu')}>
              {navLinks(true)}
              {isLoggedIn && hasMinRole('user') && <Link to="/portal/editor" className="lvm-worship-nav__link" onClick={closeDrawer} aria-current={matches(pathname, '/portal/editor') ? 'page' : undefined}>{t('songEditor')}</Link>}
              {isLoggedIn && hasMinRole('admin') && <Link to="/admin" className="lvm-worship-nav__link" onClick={closeDrawer} aria-current={matches(pathname, '/admin') ? 'page' : undefined}>{t('adminPortal')}</Link>}
            </nav>
            <div className="lvm-worship-nav__drawer-footer">
              <OfflineBadge forceText />
              <SettingsCluster orientation="column" />
              {!loading && (isLoggedIn ? <>
                <Link to="/profile" onClick={closeDrawer}>{profile?.display_name || t('profile')}</Link>
                <button type="button" onClick={signOut}><LogOutIcon />{t('signOut')}</button>
              </> : <Link to="/login" onClick={closeDrawer}>{t('signIn')}</Link>)}
            </div>
          </aside>
        </div>,
        portalHost,
      )}
    </>
  )
}
