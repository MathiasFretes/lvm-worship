import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { songCountLabel } from './songCountLabel'

export default function LvmSetlistsRail({
  setlists, loading, error, currentId, limit, atLimit, isLoggedIn,
  onOpen, onCreate, onRename, onDuplicate, onDelete, onRetry,
}) {
  const { t } = useTranslation('pages')
  const [menu, setMenu] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [draft, setDraft] = useState('')
  const [deleting, setDeleting] = useState(null)
  const renameHandled = useRef(false)

  function finishRename(id) {
    if (renameHandled.current) return
    renameHandled.current = true
    const next = draft.trim()
    setRenaming(null)
    if (next && next !== setlists.find(row => row.id === id)?.name) onRename(id, next)
  }

  return (
    <nav className="lvm-set-nav" aria-label={t('setlist.savedSets')}>
      <header><p className="lvm-set-editor__eyebrow">LVM Worship</p><h2>{t('setlist.savedSets')}</h2></header>
      {!isLoggedIn ? <div className="lvm-set-nav__notice"><h3>{t('setlist.signInTitle')}</h3><p>{t('setlist.signInBody')}</p><Link to="/login">{t('setlist.signIn')}</Link></div> : (
        <>
          <button type="button" className="lvm-set-nav__create" onClick={onCreate}>{t('setlist.newSet')}</button>
          {loading ? <p role="status">{t('setlist.loading')}</p> : error ? <p role="alert">{t('setlist.failedLoad')} <button type="button" onClick={onRetry}>{t('setlist.retry')}</button></p> : setlists.length === 0 ? <p>{t('setlist.noSavedSets')}</p> : (
            <ul className="lvm-set-nav__list">{setlists.map(row => (
              <li key={row.id} className={currentId === row.id ? 'is-current' : ''}>
                {renaming === row.id ? (
                  <input autoFocus aria-label={t('setlist.fieldName')} value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => finishRename(row.id)} onKeyDown={event => {
                    if (event.key === 'Enter') finishRename(row.id)
                    if (event.key === 'Escape') { renameHandled.current = true; setRenaming(null) }
                  }} />
                ) : <button type="button" className="lvm-set-nav__open" aria-current={currentId === row.id ? 'page' : undefined} onClick={() => onOpen(row.id)}><strong>{row.name}</strong><small>{songCountLabel(t, row.songCount)}</small></button>}
                <button type="button" className="lvm-set-nav__more" aria-label={t('setlist.setActionsFor', { name: row.name })} aria-expanded={menu === row.id} onClick={() => setMenu(value => value === row.id ? null : row.id)}>⋯</button>
                {menu === row.id ? <div className="lvm-set-nav__menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { renameHandled.current = false; setDraft(row.name); setRenaming(row.id); setMenu(null) }}>{t('setlist.rename')}</button>
                  <button type="button" role="menuitem" onClick={() => { setMenu(null); onDuplicate(row.id) }}>{t('setlist.duplicateSet')}</button>
                  <button type="button" role="menuitem" onClick={() => { setMenu(null); setDeleting(row.id) }}>{t('setlist.deleteSet')}</button>
                </div> : null}
                {deleting === row.id ? <div className="lvm-set-nav__confirm"><p>{t('setlist.deletePrompt')}</p><button type="button" onClick={() => { setDeleting(null); onDelete(row.id) }}>{t('setlist.yes')}</button><button type="button" onClick={() => setDeleting(null)}>{t('setlist.no')}</button></div> : null}
              </li>
            ))}</ul>
          )}
          <p className="lvm-set-nav__limit">{Number.isFinite(limit) ? t('setlist.usageCount', { count: setlists.length, limit }) : t('setlist.usageCountUnlimited', { count: setlists.length })}{atLimit ? ` · ${t('setlist.atLimit')}` : ''}</p>
        </>
      )}
    </nav>
  )
}
