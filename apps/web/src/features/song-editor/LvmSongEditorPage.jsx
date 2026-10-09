import { useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { canDirectWrite, submitSongSuggestion } from '@lavozmisionera/core'
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
import { deleteEditableSong, loadEditableSong, saveEditableSong } from './songEditorRepository'
import { readChordProFile, songFormFromRow, songFormToRow, validateSongForm } from './songEditorModel'
import './lvm-song-editor.css'

const SECTIONS = [
  { label: 'Verse', directive: 'verse' },
  { label: 'Chorus', directive: 'chorus' },
  { label: 'Bridge', directive: 'bridge' },
]

export default function LvmSongEditorPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const personalId = searchParams.get('p')
  const navigate = useNavigate()
  const { session } = useAuth()
  const { role, isAtLeast } = useRole()
  const { songs } = useSongs()
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
  const [search, setSearch] = useState('')
  const [chord, setChord] = useState('G')
  const bodyRef = useRef(null)
  const fileRef = useRef(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm)

  useEffect(() => {
    let active = true
    setStatus('loading')
    setFailure('')
    setErrors({})
    setNotice('')
    loadEditableSong(supabase, { slug, personalId })
      .then(result => {
        if (!active) return
        if (!result) { setStatus('missing'); return }
        setExisting(result)
        setForm(result.form)
        setSavedForm(result.form)
        setStatus('ready')
      })
      .catch(error => {
        if (active) { setFailure(error.message || 'Could not load song'); setStatus('error') }
      })
    return () => { active = false }
  }, [slug, personalId, revision])

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
      setNotice(`Imported ${file.name}`)
    } catch (error) {
      setFailure(error.message || 'Could not import file')
    }
  }

  async function save() {
    const nextErrors = validateSongForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || saving) return
    setSaving(true)
    setFailure('')
    setNotice('')
    try {
      const result = await saveEditableSong(supabase, { form, existing, role, actorId: session?.user?.id })
      if (result.kind === 'invalid') { setErrors(result.errors); return }
      setForm(result.form)
      setSavedForm(result.form)
      if (result.kind === 'published') {
        setExisting({ kind: 'published', row: result.row, form: result.form })
        setNotice('Song saved')
        if (result.row.slug !== slug) navigate(`/portal/editor/${result.row.slug}`, { replace: true })
      } else if (result.kind === 'personal') {
        setExisting({ kind: 'personal', row: result.row, form: result.form })
        setNotice('Draft saved')
      } else {
        setNotice('Suggestion submitted for review')
      }
    } catch (error) {
      setFailure(error.message || 'Could not save song')
    } finally {
      setSaving(false)
    }
  }

  async function submitDraft() {
    const nextErrors = validateSongForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || saving || existing?.kind !== 'personal') return
    setSaving(true)
    setFailure('')
    try {
      const saved = await saveEditableSong(supabase, { form, existing, role, actorId: session?.user?.id })
      await submitSongSuggestion(supabase, {
        type: saved.row.source_song_id ? 'edit' : 'addition',
        payload: songFormToRow(form),
        songId: saved.row.source_song_id || null,
        personalSongId: saved.row.id,
      })
      const { error } = await supabase.from('personal_songs').update({ status: 'submitted' }).eq('id', saved.row.id)
      if (error) throw error
      setNotice('Draft submitted for review')
      navigate('/songs')
    } catch (error) {
      setFailure(error.message || 'Could not submit draft')
    } finally {
      setSaving(false)
    }
  }

  async function savePptxUrl(url) {
    if (existing?.kind !== 'published') return
    const { error } = await supabase.from('songs').update({ pptx_url: url || null }).eq('id', existing.row.id)
    if (error) throw error
    setForm(current => ({ ...current, pptx_url: url || '' }))
    setSavedForm(current => ({ ...current, pptx_url: url || '' }))
  }

  async function deleteSong() {
    if (existing?.kind !== 'published') return
    if (!window.confirm(`Delete or request deletion of “${form.title}”?`)) return
    setFailure('')
    try {
      await deleteEditableSong(supabase, { song: existing.row, role, actorId: session?.user?.id })
      navigate('/songs')
    } catch (error) {
      setFailure(error.message || 'Could not delete song')
    }
  }

  function cancel() {
    if (dirty) setConfirmCancel(true)
    else navigate('/songs')
  }

  return (
    <main className="lvm-song-editor">
      <Helmet><title>{form.title ? `Edit ${form.title}` : 'Song Editor'} – La Voz Misionera</title></Helmet>
      <header className="lvm-song-editor__header">
        <div>
          <p className="lvm-song-editor__eyebrow">LVM Worship</p>
          <h1>{existing?.kind === 'published' || existing?.kind === 'personal' ? 'Edit song' : 'New song'}</h1>
          <p>Prepare lyrics, chords and song details for the worship team.</p>
        </div>
        <button type="button" className="lvm-song-editor__secondary" onClick={cancel}>Back to library</button>
      </header>

      <section className="lvm-song-editor__finder" aria-label="Find song to edit">
        <label htmlFor="editor-find">Find a song to edit</label>
        <input id="editor-find" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Title or artist" />
        {matches.length > 0 ? (
          <div className="lvm-song-editor__matches">
            {matches.map(song => (
              <Link key={song.id} to={`/portal/editor/${song.slug || song.id}`} onClick={event => { if (dirty && !window.confirm('Discard unsaved changes?')) event.preventDefault() }}>
                {song.title}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {status === 'loading' ? <p role="status">Loading song…</p> : null}
      {status === 'error' ? <div role="alert" className="lvm-song-editor__message">{failure} <button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : null}
      {status === 'missing' ? <div role="alert" className="lvm-song-editor__message">Song not found. <Link to="/portal/editor">Create a song</Link></div> : null}

      {status === 'ready' ? (
        <>
          {notice ? <p role="status" className="lvm-song-editor__message">{notice}</p> : null}
          {failure ? <p role="alert" className="lvm-song-editor__message">{failure}</p> : null}
          <div className="lvm-song-editor__columns">
            <section className="lvm-song-editor__panel" aria-label="Song details">
              <h2>Song details</h2>
              <div className="lvm-song-editor__fields">
                <label>Title *<input value={form.title} onChange={event => change('title', event.target.value)} disabled={saving} aria-invalid={!!errors.title} />{errors.title ? <span role="alert">{errors.title}</span> : null}</label>
                <label>Artist / author<input value={form.artist} onChange={event => change('artist', event.target.value)} disabled={saving} /></label>
                <label>Key *<select value={form.default_key} onChange={event => change('default_key', event.target.value)} disabled={saving} aria-invalid={!!errors.default_key}><option value="">Choose a key</option>{CHROMATIC_KEYS.map(key => <option key={key} value={key}>{key}</option>)}</select>{errors.default_key ? <span role="alert">{errors.default_key}</span> : null}</label>
                <label>Tags *<input value={form.tags.join(', ')} onChange={event => change('tags', event.target.value.split(','))} disabled={saving} placeholder="Worship, Easter" aria-invalid={!!errors.tags} />{errors.tags ? <span role="alert">{errors.tags}</span> : null}</label>
                <label>Tempo (BPM)<input type="number" min="20" max="400" value={form.tempo ?? ''} onChange={event => change('tempo', event.target.value)} disabled={saving} aria-invalid={!!errors.tempo} />{errors.tempo ? <span role="alert">{errors.tempo}</span> : null}</label>
                <label>Time signature<select value={form.time_signature} onChange={event => change('time_signature', event.target.value)} disabled={saving}><option value="">Select</option>{['4/4', '3/4', '2/4', '6/8'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                <label>Language<input value={form.language} onChange={event => change('language', event.target.value)} disabled={saving} /></label>
                <label>Country<input value={form.country} onChange={event => change('country', event.target.value)} disabled={saving} /></label>
                <label>YouTube ID or URL<input value={form.youtube_id} onChange={event => change('youtube_id', event.target.value)} disabled={saving} aria-invalid={!!errors.youtube_id} />{errors.youtube_id ? <span role="alert">{errors.youtube_id}</span> : null}</label>
              </div>
              {existing?.kind === 'published' ? <div className="lvm-song-editor__attachment"><h3>Presentation file</h3><PptxAttachment value={form.pptx_url} onChange={value => change('pptx_url', value)} onSaved={savePptxUrl} disabled={saving} slug={existing.row.slug} title={form.title} /></div> : null}
            </section>

            <section className="lvm-song-editor__panel" aria-label="Lyrics and chords">
              <div className="lvm-song-editor__panel-heading"><h2>Lyrics and chords</h2><button type="button" className="lvm-song-editor__secondary" onClick={() => setShowGuide(true)}>ChordPro guide</button></div>
              <div className="lvm-song-editor__tools">
                <select aria-label="Chord to insert" value={chord} onChange={event => setChord(event.target.value)}>{CHROMATIC_KEYS.map(key => <option key={key} value={key}>{key}</option>)}</select>
                <button type="button" onClick={insertChord}>Insert chord</button>
                {SECTIONS.map(section => <button key={section.directive} type="button" onClick={() => insertSection(section.directive, section.label)}>{section.label}</button>)}
              </div>
              <label htmlFor="lvm-chordpro-body">ChordPro song body</label>
              <textarea id="lvm-chordpro-body" ref={bodyRef} value={form.chordpro_content} onChange={event => change('chordpro_content', event.target.value)} disabled={saving} spellCheck={false} placeholder={'{start_of_verse: Verse 1}\n[G]Amazing grace\n{end_of_verse}'} />
              <div className="lvm-song-editor__tools">
                <button type="button" onClick={() => fileRef.current?.click()}>Import ChordPro</button>
                <input ref={fileRef} type="file" accept=".chordpro,.pro,.chord,.cho,.cpr" onChange={importFile} hidden />
                <button type="button" onClick={() => setShowPreview(true)}>Preview</button>
              </div>
            </section>
          </div>

          {existing?.kind === 'published' && isAtLeast('editor') ? <SuggestionReviewPanel songId={existing.row.id} currentSong={existing.row} onApproved={() => {}} onRejected={() => {}} onTouchUp={suggestion => setForm(current => ({ ...current, ...suggestion.payload }))} /> : null}

          <footer className="lvm-song-editor__actions">
            <button type="button" className="lvm-song-editor__primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : (existing?.kind === 'personal' ? 'Save draft' : canDirectWrite(role) ? 'Save song' : 'Submit for review')}</button>
            {existing?.kind === 'personal' ? <button type="button" className="lvm-song-editor__secondary" onClick={submitDraft} disabled={saving}>Submit draft</button> : null}
            <button type="button" className="lvm-song-editor__secondary" onClick={() => { setForm(savedForm); setErrors({}); setFailure(''); setNotice('') }} disabled={!dirty || saving}>Discard changes</button>
            <button type="button" className="lvm-song-editor__secondary" onClick={cancel}>Cancel</button>
            {existing?.kind === 'published' && isAtLeast('editor') ? <button type="button" className="lvm-song-editor__danger" onClick={deleteSong}>Delete / request deletion</button> : null}
          </footer>
        </>
      ) : null}

      {confirmCancel ? <div role="dialog" aria-modal="true" aria-label="Discard unsaved changes" className="lvm-song-editor__confirm"><div><h2>Discard unsaved changes?</h2><p>Your edits have not been saved.</p><button type="button" onClick={() => setConfirmCancel(false)}>Keep editing</button><button type="button" onClick={() => navigate('/songs')}>Discard and leave</button></div></div> : null}
      {showPreview ? <LivePreviewModal content={form.chordpro_content} metadata={{ title: form.title, currentKey: form.default_key }} onClose={() => setShowPreview(false)} /> : null}
      <ChordProGuideDrawer open={showGuide} onClose={() => setShowGuide(false)} />
    </main>
  )
}
