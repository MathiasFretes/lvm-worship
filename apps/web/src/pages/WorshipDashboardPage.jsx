import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookIcon, MusicIcon, SearchIcon, SetlistIcon, SyncIcon } from '../components/Icons'
import { useAuth } from '../hooks/useAuth'
import { useWorshipDashboardData } from '../features/dashboard/useWorshipDashboardData'
import './worship-dashboard.css'

const SITE_URL = 'https://lavozmisionera.com'

export default function WorshipDashboardPage() {
  const { t } = useTranslation('home')
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const { status, total, songs, retry } = useWorshipDashboardData()
  const [query, setQuery] = useState('')
  const setlistPath = isLoggedIn ? '/setlists' : '/setlist'

  function search(event) {
    event.preventDefault()
    const value = query.trim()
    navigate(value ? `/songs?q=${encodeURIComponent(value)}` : '/songs')
  }

  return (
    <div className="lvm-dashboard">
      <Helmet>
        <title>{t('pageTitle')}</title>
        <meta name="description" content={t('pageDescription')} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={t('pageTitle')} />
        <meta property="og:description" content={t('pageDescription')} />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <link rel="canonical" href={`${SITE_URL}/`} />
      </Helmet>

      <div className="lvm-dashboard__container">
        <section className="lvm-dashboard__hero" aria-labelledby="lvm-dashboard-title">
          <div>
            <p className="lvm-dashboard__eyebrow">LA VOZ MISIONERA · WORSHIP</p>
            <h1 id="lvm-dashboard-title">{t('title')}</h1>
            <p className="lvm-dashboard__intro">{t('intro')}</p>
          </div>
          <form className="lvm-dashboard__search" role="search" onSubmit={search}>
            <label htmlFor="lvm-dashboard-search">{t('searchLabel')}</label>
            <div className="lvm-dashboard__search-row">
              <SearchIcon />
              <input
                id="lvm-dashboard-search"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('searchPlaceholder')}
              />
              <button type="submit">{t('searchAction')}</button>
            </div>
          </form>
        </section>

        <section className="lvm-dashboard__section" aria-labelledby="lvm-dashboard-tools">
          <div className="lvm-dashboard__section-heading">
            <h2 id="lvm-dashboard-tools">{t('toolsTitle')}</h2>
            <p>{t('toolsDescription')}</p>
          </div>
          <div className="lvm-dashboard__tools">
            <ToolLink to="/songs" icon={<MusicIcon />} title={t('songsTitle')} description={t('songsDescription')} detail={status === 'ready' ? t('songCount', { count: total }) : null} />
            <ToolLink to={setlistPath} icon={<SetlistIcon />} title={t('setlistsTitle')} description={t('setlistsDescription')} />
            <ToolLink to="/songbook" icon={<BookIcon />} title={t('songbookTitle')} description={t('songbookDescription')} />
          </div>
        </section>

        <section className="lvm-dashboard__section" aria-labelledby="lvm-dashboard-catalog">
          <div className="lvm-dashboard__section-heading lvm-dashboard__section-heading--row">
            <div>
              <h2 id="lvm-dashboard-catalog">{t('catalogTitle')}</h2>
              <p>{t('catalogDescription')}</p>
            </div>
            <Link to="/songs" className="lvm-dashboard__all-link">{t('viewAll')} <ArrowRight /></Link>
          </div>
          {status === 'loading' && (
            <div className="lvm-dashboard__feedback" role="status" aria-live="polite">
              <span className="lvm-dashboard__loading-mark" aria-hidden="true" />
              <p>{t('loading')}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="lvm-dashboard__feedback" role="alert">
              <h3>{t('errorTitle')}</h3>
              <p>{t('errorDescription')}</p>
              <button type="button" onClick={retry}><SyncIcon />{t('retry')}</button>
            </div>
          )}
          {status === 'ready' && total === 0 && (
            <div className="lvm-dashboard__feedback" role="status">
              <h3>{t('emptyTitle')}</h3>
              <p>{t('emptyDescription')}</p>
              <Link to="/songs">{t('viewLibrary')}</Link>
            </div>
          )}
          {status === 'ready' && total > 0 && (
            <div className="lvm-dashboard__songs">
              {songs.map(song => (
                <Link key={song.id} to={`/song/${encodeURIComponent(song.id)}`} className="lvm-dashboard__song">
                  <span className="lvm-dashboard__song-icon" aria-hidden="true"><MusicIcon /></span>
                  <span className="lvm-dashboard__song-copy">
                    <strong>{song.title}</strong>
                    {song.artist && <small>{song.artist}</small>}
                  </span>
                  {song.key && <span className="lvm-dashboard__song-key">{song.key}</span>}
                  <ArrowRight />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ToolLink({ to, icon, title, description, detail }) {
  return (
    <Link to={to} className="lvm-dashboard__tool">
      <span className="lvm-dashboard__tool-icon" aria-hidden="true">{icon}</span>
      <span className="lvm-dashboard__tool-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        {detail && <small>{detail}</small>}
      </span>
      <ArrowRight />
    </Link>
  )
}
