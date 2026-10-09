import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import KeySelector from '../../components/KeySelector'
import { effectiveEntryKey } from '../../utils/setlists/entries'

export default function LvmSetlistEditor({
  name, items, persisted, saving, saveFailed, renameSignal, selectedKey, onSelect,
  onRename, onMoveBy, onRemove, onDuplicate, onKeyChange,
  onArrangementChange, sectionLabels = {}, onAddVerse, onShortcuts,
}) {
  const { t } = useTranslation('pages')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const renameHandled = useRef(false)

  useEffect(() => { if (renameSignal > 0) { renameHandled.current = false; setEditing(true) } }, [renameSignal])
  useEffect(() => { if (!editing) setDraft(name) }, [name, editing])

  function finishRename() {
    if (!editing || renameHandled.current) return
    renameHandled.current = true
    const next = draft.trim()
    setEditing(false)
    if (next && next !== name) onRename(next)
  }

  return (
    <section className="lvm-set-editor" aria-label={t('setlist.currentTab', { count: items.length })}>
      <header className="lvm-set-editor__header">
        <div>
          <p className="lvm-set-editor__eyebrow">LVM Worship · {t('setlist.title')}</p>
          {editing ? (
            <input
              autoFocus
              aria-label={t('setlist.fieldName')}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onBlur={finishRename}
              onKeyDown={event => {
                if (event.key === 'Enter') finishRename()
                if (event.key === 'Escape') { renameHandled.current = true; setDraft(name); setEditing(false) }
              }}
            />
          ) : (
            <h1><button type="button" onClick={() => { renameHandled.current = false; setEditing(true) }}>{name || t('setlist.untitledSet')} <span aria-hidden="true">✎</span></button></h1>
          )}
          <p className="lvm-set-editor__summary">{t('setlist.currentTab', { count: items.length })}</p>
        </div>
        <span className={`lvm-set-editor__state${saveFailed ? ' is-error' : ''}`} role="status">
          {saveFailed ? t('setlist.saveFailed') : saving ? t('setlist.saving') : persisted ? t('setlist.saved') : t('setlist.savedOnDevice')}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="lvm-set-editor__empty">
          <h2>{t('setlist.emptySet')}</h2>
          <p>{t('setlist.addSongs')}</p>
        </div>
      ) : (
        <ol className="lvm-set-editor__items">
          {items.map((item, index) => {
            const song = item.song || {}
            const verse = Boolean(song.verse)
            return (
              <li key={item.entryKey} className={`lvm-set-editor__item lvm-set-row${selectedKey === item.entryKey ? ' is-selected' : ''}`} tabIndex={0} onFocus={() => onSelect(item.entryKey)}>
                <span className="lvm-set-editor__number" aria-hidden="true">{index + 1}</span>
                <div className="lvm-set-editor__song">
                  <strong>{song.title || t('setlist.scripture')}</strong>
                  <small>{song.artist || (verse ? song.translation : '') || 'LVM Worship'}</small>
                  {!verse && onArrangementChange ? (
                    <label>{t('setlist.sectionOrder')}
                      <input
                        aria-label={`${t('setlist.sectionOrder')} — ${song.title}`}
                        value={item.sectionOrderText || ''}
                        placeholder="1,2,1,2"
                        onChange={event => onArrangementChange(item.entryKey, event.target.value)}
                      />
                      <small>{(sectionLabels[item.songId] || []).map((label, i) => `${i + 1}=${label}`).join(' · ')}</small>
                    </label>
                  ) : null}
                </div>
                <div className="lvm-set-editor__key">
                  {verse ? null : <KeySelector baseKey={song.default_key || 'C'} valueKey={effectiveEntryKey(item) || 'C'} title={t('setlist.keyFor', { title: song.title })} onChange={key => onKeyChange(item.entryKey, key)} />}
                </div>
                <div className="lvm-set-editor__item-actions">
                  <button type="button" aria-label={`${t('setlist.moveUp')} — ${song.title}`} disabled={index === 0} onClick={() => onMoveBy(item.entryKey, -1)}>↑</button>
                  <button type="button" aria-label={`${t('setlist.moveDown')} — ${song.title}`} disabled={index === items.length - 1} onClick={() => onMoveBy(item.entryKey, 1)}>↓</button>
                  <button type="button" aria-label={`${t('setlist.duplicateSong')} — ${song.title}`} onClick={() => onDuplicate(item.entryKey)}>＋</button>
                  <button type="button" aria-label={`${t('setlist.remove')} — ${song.title}`} onClick={() => onRemove(item.entryKey)}>×</button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <footer className="lvm-set-editor__footer">
        <button type="button" onClick={onAddVerse}>{t('setlist.addVerse')}</button>
        <button type="button" onClick={onShortcuts}>{t('setlist.shortcutsHint')}</button>
      </footer>
    </section>
  )
}
