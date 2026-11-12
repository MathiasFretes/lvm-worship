import React, { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_SCORE_NOTE, DURATIONS, EMPTY_SCORE, METERS, REST_SYMBOLS, SCORE_MAX_BYTES, SCORE_MAX_MEASURES, STEPS,
  editScoreNote, fillScoreMeasure, measureTicks, meterTicks, parseScoreDraft, scoreStaff,
} from '@lavozmisionera/core/music/score'
import { readMusicXml, writeMusicXml } from '@lavozmisionera/core/music/musicXml'
import { scoreEventAt } from '@lavozmisionera/core/music/scorePlayback'
import { Button, PageHeader } from '../../components/ui/layout-kit'
import TabPlayback from '../tablature/TabPlayback'
import './score.css'

const draftKey = 'lvm.worship.score.v1'
const flags = { eighth: 1, '16th': 2, '32nd': 3 }

export default function ScorePage() {
  const { t } = useTranslation('pages', { keyPrefix: 'score' })
  const [score, setScore] = useState(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      return raw ? parseScoreDraft(raw) : EMPTY_SCORE
    } catch { return EMPTY_SCORE }
  })
  const [measure, setMeasure] = useState(0)
  const [selection, setSelection] = useState(null)
  const [note, setNote] = useState(DEFAULT_SCORE_NOTE)
  const [incoming, setIncoming] = useState(null)
  const [error, setError] = useState('')
  const [position, setPosition] = useState(null)
  const [storageFailed, setStorageFailed] = useState(false)
  const picker = useRef(null)
  const importId = useRef(0)
  const viewport = useRef(null)
  const visibleMeasure = Math.min(position?.measure ?? measure, score.measures.length - 1)
  const notes = score.measures[visibleMeasure]
  const sounding = position ? scoreEventAt(notes, position.column) : -1
  const staff = scoreStaff(notes, score.clef)
  const ticks = measureTicks(notes)
  const capacity = meterTicks(score.meter)
  const [beats, beatUnit] = score.meter.split('/')
  const complete = score.measures.every(bar => measureTicks(bar) === capacity)

  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(score)); setStorageFailed(false) } catch { setStorageFailed(true) }
  }, [score])

  useEffect(() => {
    const container = viewport.current
    const current = container?.querySelector('[aria-current="true"]')
    if (!container || !current) return
    const bounds = container.getBoundingClientRect()
    const event = current.getBoundingClientRect()
    if (event.left < bounds.left || event.right > bounds.right) {
      container.scrollLeft += event.left - bounds.left
    }
  }, [visibleMeasure, sounding])

  function changeMeasure(index) {
    setMeasure(index)
    setSelection(null)
    setError('')
  }

  function setMeter(meter) {
    if (score.measures.some(bar => measureTicks(bar) > meterTicks(meter))) {
      setError('meterError')
      return
    }
    setError('')
    setScore({ ...score, meter })
  }

  function apply(nextNote) {
    const edited = editScoreNote(score, measure, selection ?? notes.length, nextNote)
    if (!edited) {
      setError('noteError')
      return
    }
    setScore(edited)
    setSelection(null)
    setError('')
  }

  async function readFile(event) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const request = ++importId.current
    setIncoming(null)
    setError('')
    try {
      if (file.size > SCORE_MAX_BYTES) throw new Error()
      const result = readMusicXml(await file.text())
      if (request === importId.current) setIncoming(result)
    } catch {
      if (request === importId.current) setError('importError')
    }
  }

  function exportScore() {
    const xml = writeMusicXml(score)
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'partitura.musicxml'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function setPitch(patch) {
    setNote({ ...note, pitch: { ...(note.pitch ?? DEFAULT_SCORE_NOTE.pitch), ...patch } })
  }

  function noteName(value, index) {
    const pitch = value.pitch ? `${value.pitch.step}${value.pitch.alter === 1 ? '♯' : value.pitch.alter === -1 ? '♭' : ''}${value.pitch.octave}` : t('rest')
    return t('noteLabel', { index: index + 1, pitch, duration: t(`duration.${value.type}`), dot: value.dotted ? t('dot') : '' })
  }

  return (
    <section className="container lvm-score">
      <Helmet><title>{t('title')} | LVM Worship</title></Helmet>
      <Button as={Link} to="/songs" variant="ghost">{t('back')}</Button>
      <PageHeader title={t('title')} subtitle={t('description')} actions={<>
        <input type="file" ref={picker} accept=".musicxml,.xml,application/xml,text/xml" hidden onChange={readFile} />
        <Button onClick={() => picker.current?.click()}>{t('import')}</Button>
        <Button variant="primary" onClick={exportScore} disabled={!complete}>{t('export')}</Button>
      </>} />
      {storageFailed && <p role="alert">{t('storageError')}</p>}
      {error && <p role="alert">{t(error)}</p>}
      {incoming && <section className="lvm-score__panel" aria-label={t('importPreview')}>
        <strong>{incoming.title || t('untitled')}</strong>
        <span>{t('summary', { count: incoming.measures.length, meter: incoming.meter, tempo: incoming.tempo })}</span>
        <span>{t('importScope')}</span>
        <div className="lvm-score__row">
          <Button onClick={() => setIncoming(null)}>{t('cancel')}</Button>
          <Button variant="primary" onClick={() => { setScore(incoming); setIncoming(null); changeMeasure(0) }}>{t('replace')}</Button>
        </div>
      </section>}
      <div className="lvm-score__row">
        <label>{t('name')} <input maxLength={120} value={score.title} onChange={event => setScore({ ...score, title: event.target.value })} /></label>
        <label>{t('tempo')} <input type="number" min="30" max="300" defaultValue={score.tempo} key={score.tempo}
          onBlur={event => {
            const tempo = Number(event.target.value)
            if (Number.isInteger(tempo) && tempo >= 30 && tempo <= 300) setScore({ ...score, tempo })
            else event.target.value = String(score.tempo)
          }} /></label>
        <label>{t('meter')} <select aria-label={t('meter')} value={score.meter} onChange={event => setMeter(event.target.value)}>
          {METERS.map(value => <option key={value}>{value}</option>)}
        </select></label>
        <label>{t('clef')} <select aria-label={t('clef')} value={score.clef} onChange={event => setScore({ ...score, clef: event.target.value })}>
          <option value="G">{t('treble')}</option><option value="F">{t('bass')}</option>
        </select></label>
      </div>
      <div className="lvm-score__panel">
        <TabPlayback score={score} onPosition={setPosition} />
        <div className="lvm-score__row">
          <label>{t('measure')} <select aria-label={t('measure')} disabled={Boolean(position)} value={visibleMeasure} onChange={event => changeMeasure(Number(event.target.value))}>
            {score.measures.map((_, index) => <option key={index} value={index}>{index + 1}</option>)}
          </select></label>
          <Button disabled={Boolean(position) || score.measures.length >= SCORE_MAX_MEASURES} onClick={() => {
            setScore({ ...score, measures: [...score.measures, []] })
            changeMeasure(score.measures.length)
          }}>{t('addMeasure')}</Button>
          <Button disabled={Boolean(position) || score.measures.length < 2 || notes.length > 0} onClick={() => {
            setScore({ ...score, measures: score.measures.filter((_, index) => index !== measure) })
            changeMeasure(Math.max(0, measure - 1))
          }}>{t('deleteMeasure')}</Button>
          <Button disabled={Boolean(position) || ticks === capacity} onClick={() => { setScore(fillScoreMeasure(score, measure)); setError('') }}>{t('fill')}</Button>
          <span>{t('pulses', { used: ticks / 8, total: capacity / 8 })}</span>
        </div>
        <div className="lvm-score__viewport" ref={viewport}>
          <div className="lvm-score__staff" style={{ height: staff.height }}>
            {staff.lines.map(y => <span key={y} className="lvm-score__line" style={{ top: y }} aria-hidden />)}
            <span className="lvm-score__barline" style={{ top: staff.lines[4], height: staff.lines[0] - staff.lines[4] }} aria-hidden />
            <span className="lvm-score__clef" style={{ top: score.clef === 'G' ? staff.lines[1] - 23 : staff.lines[3] - 11 }} aria-hidden>{score.clef === 'G' ? '𝄞' : '𝄢'}</span>
            <span className="lvm-score__meter" style={{ top: staff.lines[4] + 8 }} aria-hidden><span>{beats}</span><span>{beatUnit}</span></span>
            {notes.map((value, index) => {
              const { y, ledgers, stemDown, accidental } = staff.notes[index]
              return <button key={index} type="button" className="lvm-score__note" aria-label={noteName(value, index)}
                disabled={Boolean(position)} aria-current={sounding === index ? 'true' : undefined}
                aria-pressed={!position && selection === index} onClick={() => { setNote(value); setSelection(index); setError('') }}>
                {ledgers.map(line => <span key={line} className="lvm-score__ledger" style={{ top: line }} aria-hidden />)}
                {value.pitch ? <>
                  {accidental && <span className="lvm-score__accidental" style={{ top: y - 11 }} aria-hidden>{accidental}</span>}
                  <span className={`lvm-score__head ${['whole', 'half'].includes(value.type) ? 'is-open' : ''}`} style={{ top: y - 4 }} aria-hidden />
                  {value.type !== 'whole' && <span className={`lvm-score__stem ${stemDown ? 'is-down' : ''}`} style={{ top: stemDown ? y : y - 25 }} aria-hidden />}
                  {Array.from({ length: flags[value.type] ?? 0 }, (_, flag) => <span key={flag}
                    className={`lvm-score__flag ${stemDown ? 'is-down' : ''}`} style={{ top: stemDown ? y + 18 - 5 * flag : y - 25 + 5 * flag }} aria-hidden />)}
                </> : <span className="lvm-score__rest" style={{ top: y - 18 }} aria-hidden>{REST_SYMBOLS[value.type]}</span>}
                {value.dotted && <span className="lvm-score__dot" style={{ top: y - 2 }} aria-hidden />}
              </button>
            })}
          </div>
        </div>
        <form onSubmit={event => { event.preventDefault(); apply(note) }}>
          <fieldset className="lvm-score__row lvm-score__edit" disabled={Boolean(position)}>
            <label><input type="checkbox" checked={!note.pitch} onChange={event => setNote({ ...note, pitch: event.target.checked ? null : DEFAULT_SCORE_NOTE.pitch })} /> {t('rest')}</label>
            {note.pitch && <>
              <label>{t('pitch')} <select aria-label={t('pitch')} value={note.pitch.step} onChange={event => setPitch({ step: event.target.value })}>
                {STEPS.map(step => <option key={step}>{step}</option>)}
              </select></label>
              <label>{t('alter')} <select aria-label={t('alter')} value={note.pitch.alter} onChange={event => setPitch({ alter: Number(event.target.value) })}>
                <option value="0">♮</option><option value="1">♯</option><option value="-1">♭</option>
              </select></label>
              <label>{t('octave')} <select aria-label={t('octave')} value={note.pitch.octave} onChange={event => setPitch({ octave: Number(event.target.value) })}>
                {[2, 3, 4, 5, 6, 7].map(octave => <option key={octave}>{octave}</option>)}
              </select></label>
            </>}
            <label>{t('value')} <select aria-label={t('value')} value={note.type} onChange={event => setNote({ ...note, type: event.target.value, dotted: event.target.value === '32nd' ? false : note.dotted })}>
              {Object.keys(DURATIONS).map(value => <option key={value} value={value}>{t(`duration.${value}`)}</option>)}
            </select></label>
            <label><input type="checkbox" checked={note.dotted} disabled={note.type === '32nd'} onChange={event => setNote({ ...note, dotted: event.target.checked })} /> {t('dot')}</label>
            <Button type="submit" variant="primary">{t(selection === null ? 'add' : 'apply')}</Button>
            {selection !== null && <>
              <Button onClick={() => apply(null)}>{t('remove')}</Button>
              <Button onClick={() => setSelection(null)}>{t('cancel')}</Button>
            </>}
          </fieldset>
        </form>
      </div>
      {!complete && <p>{t('incomplete')}</p>}
    </section>
  )
}
