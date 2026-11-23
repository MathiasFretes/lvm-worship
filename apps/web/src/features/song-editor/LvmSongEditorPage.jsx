import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { canDirectWrite } from '@lavozmisionera/core'
import { useAuth } from '../../hooks/useAuth'
import { useRole } from '../../hooks/useRole'
import { useSongs } from '../../hooks/useSongs'
import { supabase } from '../../lib/supabase'
import { CHROMATIC_KEYS } from '../../utils/chordpro/diatonicChords'
import { normalizeSongSearch } from '../../utils/songs/search'
import LivePreviewModal from '../../components/editor/LivePreviewModal'
import ChordProGuideDrawer from '../../components/editor/ChordProGuideDrawer'
import SuggestionReviewPanel from '../../components/editor/SuggestionReviewPanel'
import { PptxAttachment } from './PptxAttachment'
import { deleteEditableSong, loadEditableSong, saveEditableSong, submitEditableDraft, saveSongPresentation } from './songEditorRepository'
import { readChordProFile, songFormFromRow, validateSongForm } from './songEditorModel'
import { clearEditorDraft, readEditorDraft, writeEditorDraft } from './editorDraftJournal'
import './lvm-song-editor.css'

const SECTIONS = [
  { label: 'verse', directive: 'verse' },
  { label: 'chorus', directive: 'chorus' },
  { label: 'bridge', directive: 'bridge' },
]

export default function LvmSongEditorPage() {
  const { t } = useTranslation('songEditor')
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const personalId = searchParams.get('p')
  const navigate = useNavigate()
  const { session } = useAuth()
  const accountId = session?.user?.id
  const journalRoute = personalId ? `personal:${personalId}` : slug ? `song:${slug}` : 'new'
  const { role, isAtLeast } = useRole()
  const { songs, retry: refreshSongs } = useSongs()
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState('loading')
  const [existing, setExisting] = useState(null)
  const [form, setForm] = useState(() => songFormFromRow())
  const [savedForm, setSavedForm] = useState(() => songFormFromRow())
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [reviewChanged, setReviewChanged] = useState(false)
  const [search, setSearch] = useState('')
  const [chord, setChord] = useState('G')
  const bodyRef = useRef(null)
  const fileRef = useRef(null)
  const operationRef = useRef(null)
  const loadedScope = useRef(null)
  const draftLocked = existing?.kind === 'personal' && existing.row.status && existing.row.status !== 'draft'
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm)

  useEffect(() => {
    let active = true
    loadedScope.current = null
    setStatus('loading')
    setFailure('')
    setErrors({})
    setNotice('')
    loadEditableSong(supabase, { slug, personalId })
      .then(result => {
        if (!active) return
        if (!result) { setStatus('missing'); return }
        const locked = result.kind === 'personal' && result.row.status && result.row.status !== 'draft'
        const recovered = locked ? null : readEditorDraft(accountId, journalRoute)
        loadedScope.current = `${accountId}:${journalRoute}`
        setExisting(recovered?.baseUpdatedAt && result.row ? { ...result, row: { ...result.row, updated_at: recovered.baseUpdatedAt } } : result)
        setForm(recovered ? songFormFromRow(recovered.form) : result.form)
        setSavedForm(result.form)
        operationRef.current = recovered?.operation || null
        setReviewChanged(false)
        setStatus('ready')
      })
      .catch(error => {
        if (active) { setFailure(error.message || 'loadFailed'); setStatus('error') }
      })
    return () => { active = false }
  }, [slug, personalId, revision, accountId, journalRoute])

  useEffect(() => {
    if (status !== 'ready' || loadedScope.current !== `${accountId}:${journalRoute}`) return
    if (dirty) writeEditorDraft(accountId, journalRoute, { form, baseUpdatedAt: existing?.row?.updated_at, operation: operationRef.current })
  }, [accountId, journalRoute, status, dirty, form, existing])

  useEffect(() => {
    function onBeforeUnload(event) {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const matches = useMemo(() => {
    const query = normalizeSongSearch(search)
    if (!query) return []
    return songs.filter(song => normalizeSongSearch(`${song.title} ${(song.authors || []).join(' ')}`).includes(query)).slice(0, 8)
  }, [search, songs])

  function change(field, value) {
    if (draftLocked) return
    setForm(current => ({ ...current, [field]: value }))
    if (errors[field]) setErrors(current => ({ ...current, [field]: undefined }))
    setFailure('')
    setNotice('')
  }

  function editBody(next, caret) {
    change('chordpro_content', next)
    requestAnimationFrame(() => {
      bodyRef.current?.focus()
      bodyRef.current?.setSelectionRange(caret, caret)
    })
  }

  function insertChord() {
    const element = bodyRef.current
    if (!element) return
    const start = element.selectionStart
    const end = element.selectionEnd
    const marker = `[${chord}]`
    editBody(form.chordpro_content.slice(0, start) + marker + form.chordpro_content.slice(end), start + marker.length)
  }

  function insertSection(directive, label) {
    const element = bodyRef.current
    if (!element) return
    const start = element.selectionStart
    const end = element.selectionEnd
    const selected = form.chordpro_content.slice(start, end)
    const block = `{start_of_${directive}: ${label}}\n${selected}\n{end_of_${directive}}`
    editBody(form.chordpro_content.slice(0, start) + block + form.chordpro_content.slice(end), start + block.length)
  }

  async function importFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = readChordProFile(await file.text())
      setExisting({ kind: 'new', row: null })
      setForm(imported)
      setSavedForm(songFormFromRow())
      setErrors({})
      setFailure('')
      setNotice(t('imported', { name: file.name }))
    } catch (error) {
      setFailure(error.message === 'The ChordPro file is empty' ? t('emptyFile') : t('importFailed'))
    }
  }

  function operationId(action) {
    const signature = JSON.stringify({ action, form, id: existing?.row?.id, updatedAt: existing?.row?.updated_at })
    if (operationRef.current?.signature !== signature) operationRef.current = { signature, id: crypto.randomUUID() }
    writeEditorDraft(accountId, journalRoute, { form, baseUpdatedAt: existing?.row?.updated_at, operation: operationRef.current })
    return operationRef.current.id
  }

  async function save() {
    const nextErrors = validateSongForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || saving || draftLocked) return
    setSaving(true)
    setFailure('')
    setNotice('')
    try {
      const result = await saveEditableSong(supabase, { form, existing, role, operationId: operationId('save') })
      if (result.kind === 'invalid') { setErrors(result.errors); return }
      clearEditorDraft(accountId, journalRoute)
      setForm(result.form)
      setSavedForm(result.form)
      if (result.kind === 'published') {
        await refreshSongs?.()
        setExisting({ kind: 'published', row: result.row, form: result.form })
        setNotice(t('saved'))
        if (result.row.slug !== slug) navigate(`/portal/editor/${result.row.slug}`, { replace: true })
      } else if (result.kind === 'personal') {
        setExisting({ kind: 'personal', row: result.row, form: result.form })
        setNotice(t('draftSaved'))
      } else {
        setNotice(t('submitted'))
      }
    } catch (error) {
      if (error.code === 'PT409' || error.status === 409) { setFailure(t('saveConflict')); setReviewChanged(true) }
      else setFailure(t('saveUnconfirmed'))
    } finally {
      setSaving(false)
    }
  }

  async function submitDraft() {
    const nextErrors = validateSongForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || saving || draftLocked || existing?.kind !== 'personal') return
    setSaving(true)
    setFailure('')
    try {
      await submitEditableDraft(supabase, { form, existing, operationId: operationId('submit_draft') })
      clearEditorDraft(accountId, journalRoute)
      setNotice(t('draftSubmitted'))
      navigate('/songs')
    } catch (error) {
      if (error.code === 'PT409' || error.status === 409) { setFailure(t('saveConflict')); setReviewChanged(true) }
      else setFailure(t('saveUnconfirmed'))
    } finally {
      setSaving(false)
    }
  }

  async function savePptxUrl(url) {
    if (existing?.kind !== 'published') return
    const row = await saveSongPresentation(supabase, { song: existing.row, url, operationId: operationId(`pptx:${url || ''}`) })
    operationRef.current = null
    if (!dirty) clearEditorDraft(accountId, journalRoute)
    setExisting(current => ({ ...current, row }))
    setForm(current => ({ ...current, pptx_url: url || '' }))
    setSavedForm(current => ({ ...current, pptx_url: url || '' }))
  }

  async function deleteSong() {
    if (existing?.kind !== 'published') return
    if (!window.confirm(t('deleteQuestion', { title: form.title }))) return
    setFailure('')
    try {
      await deleteEditableSong(supabase, { song: existing.row, role, operationId: operationId('delete') })
      await refreshSongs?.()
      navigate('/songs')
    } catch (error) {
      setFailure(error.message || t('deleteFailed'))
    }
  }

  function cancel() {
    if (dirty) setConfirmCancel(true)
    else navigate('/songs')
  }

  function approved() {
    void refreshSongs?.()
    if (dirty) {
      setReviewChanged(true)
      setNotice(`${t('approved')} ${t('unsaved')}`)
    } else {
      setRevision(value => value + 1)
    }
  }

  function discard() {
    clearEditorDraft(accountId, journalRoute)
    if (reviewChanged) setRevision(value => value + 1)
    else setForm(savedForm)
    setErrors({})
    setFailure('')
    setNotice('')
  }

  return (
    <main className="lvm-song-editor">
      <Helmet><title>{form.title ? t('editTitle', { title: form.title }) : t('pageTitle')} – La Voz Misionera</title></Helmet>
      <header className="lvm-song-editor__header">
        <div>
          <p className="lvm-song-editor__eyebrow">LVM Worship</p>
          <h1>{existing?.kind === 'published' || existing?.kind === 'personal' ? t('editSong') : t('newSong')}</h1>
          <p>{t('description')}</p>
        </div>
        <button type="button" className="lvm-song-editor__secondary" onClick={cancel} disabled={saving}>{t('back')}</button>
      </header>

      <section className="lvm-song-editor__finder" aria-label={t('finder')}>
        <label htmlFor="editor-find">{t('finder')}</label>
        <input id="editor-find" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('searchPlaceholder')} disabled={saving} />
        {matches.length > 0 ? (
          <div className="lvm-song-editor__matches">
            {matches.map(song => (
              <Link key={song.id} to={`/portal/editor/${song.slug || song.id}`} onClick={event => { if (saving || (dirty && !window.confirm(t('discardQuestion')))) event.preventDefault() }}>
                {song.title}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {status === 'loading' ? <p role="status">{t('loading')}</p> : null}
      {status === 'error' ? <div role="alert" className="lvm-song-editor__message">{t(failure, { defaultValue: failure })} <button type="button" onClick={() => setRevision(value => value + 1)}>{t('retry')}</button></div> : null}
      {status === 'missing' ? <div role="alert" className="lvm-song-editor__message">{t('missing')} <Link to="/portal/editor">{t('create')}</Link></div> : null}

      {status === 'ready' ? (
        <>
          {draftLocked && existing.row.status === 'submitted' ? <p role="status" className="lvm-song-editor__message">{t('draftSubmitted')}</p> : null}
          {notice ? <p role="status" className="lvm-song-editor__message">{notice}</p> : null}
          {failure ? <p role="alert" className="lvm-song-editor__message">{t(failure, { defaultValue: failure })}</p> : null}
          <div className="lvm-song-editor__columns">
            <section className="lvm-song-editor__panel" aria-label={t('details')}>
              <h2>{t('details')}</h2>
              <div className="lvm-song-editor__fields">
                <label>{t('title')}<input value={form.title} onChange={event => change('title', event.target.value)} disabled={saving || draftLocked} aria-invalid={!!errors.title} />{errors.title ? <span role="alert">{t('validationTitle')}</span> : null}</label>
                <label>{t('artist')}<input value={form.artist} onChange={event => change('artist', event.target.value)} disabled={saving || draftLocked} /></label>
                <label>{t('key')}<select value={form.default_key} onChange={event => change('default_key', event.target.value)} disabled={saving || draftLocked} aria-invalid={!!errors.default_key}><option value="">{t('chooseKey')}</option>{CHROMATIC_KEYS.map(key => <option key={key} value={key}>{key}</option>)}</select>{errors.default_key ? <span role="alert">{t('validationKey')}</span> : null}</label>
                <label>{t('tags')}<input value={form.tags.join(', ')} onChange={event => change('tags', event.target.value.split(','))} disabled={saving || draftLocked} placeholder={t('tagsPlaceholder')} aria-invalid={!!errors.tags} />{errors.tags ? <span role="alert">{t('validationTags')}</span> : null}</label>
                <label>{t('tempo')}<input type="number" min="20" max="400" value={form.tempo ?? ''} onChange={event => change('tempo', event.target.value)} disabled={saving || draftLocked} aria-invalid={!!errors.tempo} />{errors.tempo ? <span role="alert">{t('validationTempo')}</span> : null}</label>
                <label>{t('timeSignature')}<select value={form.time_signature} onChange={event => change('time_signature', event.target.value)} disabled={saving || draftLocked}><option value="">{t('select')}</option>{['4/4', '3/4', '2/4', '6/8'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                <label>{t('language')}<input value={form.language} onChange={event => change('language', event.target.value)} disabled={saving || draftLocked} /></label>
                <label>{t('country')}<input value={form.country} onChange={event => change('country', event.target.value)} disabled={saving || draftLocked} /></label>
                <label>{t('youtube')}<input value={form.youtube_id} onChange={event => change('youtube_id', event.target.value)} disabled={saving || draftLocked} aria-invalid={!!errors.youtube_id} />{errors.youtube_id ? <span role="alert">{t('validationYoutube')}</span> : null}</label>
              </div>
              {existing?.kind === 'published' ? <div className="lvm-song-editor__attachment"><h3>{t('presentation')}</h3><PptxAttachment value={form.pptx_url} onChange={value => change('pptx_url', value)} onSaved={savePptxUrl} onBusyChange={setSaving} disabled={saving || draftLocked} slug={existing.row.slug} title={form.title} /></div> : null}
            </section>

            <section className="lvm-song-editor__panel" aria-label={t('lyrics')}>
              <div className="lvm-song-editor__panel-heading"><h2>{t('lyrics')}</h2><button type="button" className="lvm-song-editor__secondary" onClick={() => setShowGuide(true)}>{t('guide')}</button></div>
              <div className="lvm-song-editor__tools">
                <select disabled={saving || draftLocked} aria-label={t('chord')} value={chord} onChange={event => setChord(event.target.value)}>{CHROMATIC_KEYS.map(key => <option key={key} value={key}>{key}</option>)}</select>
                <button type="button" onClick={insertChord} disabled={saving || draftLocked}>{t('insertChord')}</button>
                {SECTIONS.map(section => <button key={section.directive} type="button" onClick={() => insertSection(section.directive, t(section.label))} disabled={saving || draftLocked}>{t(section.label)}</button>)}
              </div>
              <label htmlFor="lvm-chordpro-body">{t('body')}</label>
              <textarea id="lvm-chordpro-body" ref={bodyRef} value={form.chordpro_content} onChange={event => change('chordpro_content', event.target.value)} disabled={saving || draftLocked} spellCheck={false} placeholder={t('bodyPlaceholder')} />
              <div className="lvm-song-editor__tools">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={saving || draftLocked}>{t('import')}</button>
                <input ref={fileRef} type="file" accept=".chordpro,.pro,.chord,.cho,.cpr" disabled={saving || draftLocked} onChange={importFile} hidden />
                <button type="button" onClick={() => setShowPreview(true)}>{t('preview')}</button>
              </div>
            </section>
          </div>

          {existing?.kind === 'published' && isAtLeast('editor') ? <SuggestionReviewPanel songId={existing.row.id} currentSong={existing.row} onApproved={approved} onRejected={() => {}} onTouchUp={suggestion => { if (!saving) setForm(current => ({ ...current, ...suggestion.payload })) }} disabled={saving || draftLocked} /> : null}

          <footer className="lvm-song-editor__actions">
            <button type="button" className="lvm-song-editor__primary" onClick={save} disabled={saving || draftLocked}>{saving ? t('saving') : (existing?.kind === 'personal' ? t('saveDraft') : canDirectWrite(role) ? t('saveSong') : t('submit'))}</button>
            {existing?.kind === 'personal' ? <button type="button" className="lvm-song-editor__secondary" onClick={submitDraft} disabled={saving || draftLocked}>{t('submitDraft')}</button> : null}
            <button type="button" className="lvm-song-editor__secondary" onClick={discard} disabled={!dirty || saving}>{t('discard')}</button>
            <button type="button" className="lvm-song-editor__secondary" onClick={cancel} disabled={saving}>{t('cancel')}</button>
            {existing?.kind === 'published' && isAtLeast('editor') ? <button type="button" className="lvm-song-editor__danger" onClick={deleteSong} disabled={saving}>{t('delete')}</button> : null}
          </footer>
        </>
      ) : null}

      {confirmCancel ? <div role="dialog" aria-modal="true" aria-label={t('discardDialog')} className="lvm-song-editor__confirm"><div><h2>{t('discardQuestion')}</h2><p>{t('unsaved')}</p><button type="button" onClick={() => setConfirmCancel(false)}>{t('keepEditing')}</button><button type="button" onClick={() => { clearEditorDraft(accountId, journalRoute); navigate('/songs') }}>{t('leave')}</button></div></div> : null}
      {showPreview ? <LivePreviewModal content={form.chordpro_content} metadata={{ title: form.title, currentKey: form.default_key }} onClose={() => setShowPreview(false)} /> : null}
      <ChordProGuideDrawer open={showGuide} onClose={() => setShowGuide(false)} />
    </main>
  )
}
