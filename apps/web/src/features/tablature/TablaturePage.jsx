import React, { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EMPTY_GUITAR_TAB, TAB_EXAMPLE, TAB_MAX_LENGTH, parseTablature } from '@lavozmisionera/core/music/tablature'
import { Button, PageHeader } from '../../components/ui/layout-kit'
import './tablature.css'
import TablatureGrid from './TablatureGrid'

const draftKey = 'lvm.worship.tablature.draft'

export default function TablaturePage() {
  const { t } = useTranslation('pages', { keyPrefix: 'tablature' })
  const [draft, setDraft] = useState(() => {
    try { return localStorage.getItem(draftKey) ?? '' } catch { return '' }
  })
  const [imported, setImported] = useState(null)
  const [importError, setImportError] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [gridVersion, setGridVersion] = useState(0)
  const picker = useRef(null)
  const importRequest = useRef(0)
  const parsed = parseTablature(draft)
  const preview = imported?.source ?? draft

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, draft)
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [draft])

  async function readImport(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const request = ++importRequest.current
    setImported(null)
    setImportError('')
    if (file.size > TAB_MAX_LENGTH * 4) {
      setImportError('tooLarge')
      return
    }
    try {
      const result = parseTablature(await file.text())
      if (request !== importRequest.current) return
      if (result.ok) setImported(result)
      else setImportError(result.reason)
    } catch {
      if (request === importRequest.current) setImportError('readError')
    }
  }

  function exportTab() {
    if (!parsed.ok) return
    const url = URL.createObjectURL(new Blob([parsed.source], { type: 'text/plain;charset=utf-8' }))
    const download = document.createElement('a')
    download.href = url
    download.download = 'tablatura.txt'
    download.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="container lvm-tablature">
      <Helmet><title>{t('title')} | LVM Worship</title></Helmet>
      <Button as={Link} to="/songs" variant="ghost">{t('back')}</Button>
      <PageHeader title={t('title')} subtitle={t('description')} actions={<>
        <input ref={picker} type="file" accept=".txt,.tab,text/plain" hidden onChange={readImport} />
        <Button onClick={() => picker.current?.click()}>{t('import')}</Button>
        <Button variant="primary" onClick={exportTab} disabled={!parsed.ok}>{t('export')}</Button>
      </>} />
      {importError && <p role="alert">{t(importError)}</p>}
      {parsed.ok && !imported && <section className="lvm-tablature__editor" aria-labelledby="lvm-tab-grid">
        <h2 id="lvm-tab-grid">{t('grid')}</h2>
        <TablatureGrid key={gridVersion} source={parsed.source} onChange={setDraft} />
      </section>}
      <div className="lvm-tablature__workspace">
        <div className="lvm-tablature__panel">
          <label htmlFor="lvm-tab-source">{t('source')}</label>
          <textarea id="lvm-tab-source" value={draft} placeholder={TAB_EXAMPLE}
            maxLength={TAB_MAX_LENGTH} onChange={event => { setDraft(event.target.value); setGridVersion(version => version + 1) }}
            aria-describedby="lvm-tab-help" wrap="off" spellCheck={false} autoCapitalize="off" />
          <p id="lvm-tab-help" role="status">{t(storageError ? 'storageError' : draft && !parsed.ok ? parsed.reason : 'draft')}</p>
          {!draft && <Button onClick={() => setDraft(EMPTY_GUITAR_TAB)}>{t('newGrid')}</Button>}
        </div>
        <div className="lvm-tablature__panel">
          <div className="lvm-tablature__heading">
            <h2 id="lvm-tab-preview">{t(imported ? 'importPreview' : 'preview')}</h2>
            <div className="lvm-tablature__zoom">
              <Button aria-label={t('zoomOut')} disabled={zoom === 80} onClick={() => setZoom(zoom - 10)}>−</Button>
              <output aria-live="polite">{zoom}%</output>
              <Button aria-label={t('zoomIn')} disabled={zoom === 160} onClick={() => setZoom(zoom + 10)}>+</Button>
            </div>
          </div>
          <pre tabIndex={0} aria-labelledby="lvm-tab-preview" style={{ fontSize: `${zoom}%` }}>{preview || t('empty')}</pre>
          {imported && <div className="lvm-tablature__actions">
            <Button onClick={() => setImported(null)}>{t('cancel')}</Button>
            <Button variant="primary" onClick={() => { setDraft(imported.source); setImported(null); setGridVersion(version => version + 1) }}>{t('applyImport')}</Button>
          </div>}
        </div>
      </div>
    </section>
  )
}
