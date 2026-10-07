import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { searchSongs } from '../../utils/songs/search'
import { getLanguageChipLabel, resolveGroupEntry } from '../../utils/songs/songCatalog'

export default function LvmSongPicker({
  catalog, songsLoading, songsError, onRetrySongs, query, onQuery, communityOnly, onCommunityOnly,
  language, onLanguage, selectedIds, onAdd, searchRef,
}) {
  const { t } = useTranslation('pages')
  const languages = catalog.translationLanguages || []
  const results = useMemo(() => {
    const pool = (catalog.groups || [])
      .map(group => resolveGroupEntry(group, language))
      .filter(song => song && (!communityOnly || (song.tags || []).some(tag => /community/i.test(tag))))
    return (query.trim() ? searchSongs(pool, query).map(result => result.item) : pool).slice(0, 80)
  }, [catalog, language, communityOnly, query])

  return (
    <section className="lvm-set-picker" aria-label={t('setlist.addSongs')}>
      <header><p className="lvm-set-editor__eyebrow">{t('setlist.search')}</p><h2>{t('setlist.addSongs')}</h2></header>
      <div className="lvm-set-picker__filters">
        <input ref={searchRef} id="lvm-library-search" type="search" value={query} placeholder={t('setlist.search')} aria-label={t('setlist.search')} onChange={event => onQuery(event.target.value)} />
        <label><input type="checkbox" checked={communityOnly} onChange={event => onCommunityOnly(event.target.checked)} /> {t('setlist.communitySetlist')}</label>
        {languages.length > 1 ? <div className="lvm-set-picker__languages">{languages.map(code => <button type="button" key={code} aria-pressed={language === code} onClick={() => onLanguage(code)}>{getLanguageChipLabel(code)}</button>)}</div> : null}
      </div>
      <div className="lvm-set-picker__results">
        {songsError ? <p role="alert">{t('setlist.failedLoad')} <button type="button" onClick={onRetrySongs}>{t('setlist.retry')}</button></p> : null}
        {songsLoading ? <p role="status">{t('setlist.loadingSearch')}</p> : !songsError && results.length === 0 ? <p>{t('setlist.noSongsMatch', { query: query.trim() })}</p> : results.map(song => {
          const alreadyAdded = selectedIds.has(song.dbId) || selectedIds.has(song.id)
          return (
            <button type="button" key={song.id} className="lvm-set-picker__song" onClick={() => onAdd(song)} aria-label={`${song.title} — ${alreadyAdded ? t('setlist.duplicateSong') : t('setlist.addSongs')}`}>
              <span><strong>{song.title}</strong><small>{[(song.authors || []).join(', '), song.originalKey].filter(Boolean).join(' · ')}</small></span>
              <span aria-hidden="true">{alreadyAdded ? '+1' : '+'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
