import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { transposeSymPrefer, stepsBetween } from '../../utils/chordpro'
import { formatChord } from '../../utils/chordpro/solfege'
import { useSettings } from '../../hooks/useSettings'
import { Button } from '../../components/ui/layout-kit'
import { ArrowLeft, ArrowRight, CloseIcon, DownloadIcon, EyeIcon, GearIcon, MinusIcon, MusicIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, PrintIcon, ResetIcon, ShareIcon, TextFormatIcon, TunerIcon, TwoColIcon } from '../../components/Icons'
import KeySelector from '../../components/KeySelector'
import ChordDiagrams from './ChordDiagrams'
import { collectSongChords, PRACTICE_INSTRUMENTS } from './practiceMusic'
import { useAutoScroll } from './useAutoScroll'
import './songPractice.css'

const STORAGE_KEY = 'lvm.song-practice.v1'
const defaults = { fontScale: 100, diagramScale: 100, columnHeight: 80, columnWidth: 100, instrument: 'guitar', diagrams: true, diagramsEnd: false, pinDiagrams: false, inlineDiagrams: false, showTabs: true, showStrumming: true, scrollSpeed: 35 }
function readingSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      ...defaults,
      fontScale: Number.isFinite(stored.fontScale) ? Math.min(180, Math.max(70, stored.fontScale)) : defaults.fontScale,
      diagramScale: Number.isFinite(stored.diagramScale) ? Math.min(160, Math.max(80, stored.diagramScale)) : defaults.diagramScale,
      columnHeight: Number.isFinite(stored.columnHeight) ? Math.min(100, Math.max(40, stored.columnHeight)) : defaults.columnHeight,
      columnWidth: Number.isFinite(stored.columnWidth) ? Math.min(100, Math.max(60, stored.columnWidth)) : defaults.columnWidth,
      scrollSpeed: Number.isFinite(stored.scrollSpeed) ? Math.min(120, Math.max(10, stored.scrollSpeed)) : defaults.scrollSpeed,
      instrument: Object.hasOwn(PRACTICE_INSTRUMENTS, stored.instrument) ? stored.instrument : defaults.instrument,
      ...Object.fromEntries(['diagrams', 'diagramsEnd', 'pinDiagrams', 'inlineDiagrams', 'showTabs', 'showStrumming'].map(key => [key, typeof stored[key] === 'boolean' ? stored[key] : defaults[key]])),
    }
  } catch { return defaults }
}

function Tool({ name, value, icon, children }) {
  return <details className="song-practice__tool">
    <summary>{icon}<span>{name}</span><small>{value}</small><span aria-hidden="true">›</span></summary>
    <div className="song-practice__tool-body">{children}</div>
  </details>
}

export default function SongPracticeWorkspace({ songId, parsed, baseKey, toKey, onKeyChange, chordStyle, showChords, onChordsChange, twoCols, onColumnsChange, isNarrow, favorite, onDownload, editHref, onMusicSettingsChange, children }) {
  const { t } = useTranslation('practice')
  const { setChordStyle } = useSettings()
  const root = useRef(null)
  const dialog = useRef(null)
  const [query] = useSearchParams()
  const close = useRef(null)
  const openButton = useRef(null)
  const [settings, setSettings] = useState(readingSettings)
  const [capo, setCapo] = useState(() => Math.min(12, Math.max(0, Number(query.get('capo') ?? parsed?.meta?.capo) || 0)))
  const [tuning, setTuning] = useState(() => Math.min(0, Math.max(-4, Number(query.get('tuning')) || 0)))
  const [notation, setNotation] = useState(chordStyle)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [notice, setNotice] = useState('')
  const [selectedChord, setSelectedChord] = useState(null)
  const [columnPosition, setColumnPosition] = useState({ left: 0, max: 0 })
  const chordDialog = useRef(null)
  const [scrolling, setScrolling] = useAutoScroll(root, settings.scrollSpeed, songId)
  const steps = stepsBetween(baseKey, toKey)
  const flats = /b/.test(toKey)
  const symbols = useMemo(() => collectSongChords(parsed.blocks, symbol => transposeSymPrefer(symbol, steps, flats)), [parsed.blocks, steps, flats])
  const display = symbol => formatChord(symbol, { style: notation })
  const selectChord = useCallback(symbol => setSelectedChord(symbols.find(value => value === symbol || formatChord(value, { style: notation }) === symbol) || null), [symbols, notation])
  const soundingKey = transposeSymPrefer(toKey, capo + tuning, flats)
  const hasStrumming = Boolean(parsed.meta?.strumming || parsed.blocks.some(block => block.lines?.some(line => /^\s*(?:strum|rasgueo|strumming)\s*:/i.test(line.text || ''))))
  const update = (key, value) => setSettings(previous => ({ ...previous, [key]: value }))

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch {}
  }, [settings])
  useEffect(() => { onMusicSettingsChange?.({ capo, tuning }) }, [capo, tuning, onMusicSettingsChange])
  useEffect(() => {
    const chart = root.current?.querySelector('.songpage__sheet')
    if (!chart || !twoCols || isNarrow) return
    const updatePosition = () => setColumnPosition({ left: chart.scrollLeft, max: Math.max(0, chart.scrollWidth - chart.clientWidth) })
    const frame = requestAnimationFrame(updatePosition)
    chart.addEventListener('scroll', updatePosition, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePosition)
    observer?.observe(chart)
    return () => { cancelAnimationFrame(frame); chart.removeEventListener('scroll', updatePosition); observer?.disconnect() }
  }, [twoCols, isNarrow, settings.fontScale, settings.columnHeight, settings.columnWidth, settings.inlineDiagrams, parsed.blocks])
  useEffect(() => {
    if (!selectedChord) return
    const previous = document.activeElement
    const element = chordDialog.current
    if (element?.showModal) element.showModal()
    else element?.setAttribute('open', '')
    return () => { element?.close?.(); previous?.focus?.() }
  }, [selectedChord])
  useEffect(() => {
    document.body.classList.add('lvm-song-practice-active')
    document.documentElement.classList.add('lvm-song-practice-active')
    return () => {
      document.body.classList.remove('lvm-song-practice-active')
      document.documentElement.classList.remove('lvm-song-practice-active')
    }
  }, [])
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  useEffect(() => {
    if (!toolsOpen || !isNarrow) return
    const previous = document.activeElement
    if (dialog.current?.showModal) dialog.current.showModal()
    else dialog.current?.setAttribute('open', '')
    close.current?.focus()
    const escape = event => { if (event.key === 'Escape') setToolsOpen(false) }
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('keydown', escape); previous?.focus?.() }
  }, [toolsOpen, isNarrow])

  function reset() {
    setSettings(defaults)
    setCapo(Math.min(12, Math.max(0, Number(parsed?.meta?.capo) || 0)))
    setTuning(0)
    onKeyChange(baseKey)
    setNotation('letters')
    setChordStyle('letters')
    if (twoCols) onColumnsChange()
    if (!showChords) onChordsChange()
    setScrolling(false)
    setSelectedChord(null)
  }

  async function share() {
    const url = new URL(window.location.href)
    url.searchParams.set('key', toKey)
    url.searchParams.set('capo', String(capo))
    url.searchParams.set('tuning', String(tuning))
    try {
      if (navigator.share) await navigator.share({ title: parsed.meta?.title, url: url.href })
      else { await navigator.clipboard.writeText(url.href); setNotice(t('copied')) }
    } catch (error) { if (error.name !== 'AbortError') setNotice(t('shareError')) }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await root.current.requestFullscreen()
    } catch { setNotice(t('fullscreen')) }
  }

  function moveColumns(direction) {
    const chart = root.current?.querySelector('.songpage__sheet')
    chart?.scrollBy({ left: direction * chart.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  const diagrams = <ChordDiagrams symbols={symbols} instrument={settings.instrument} display={display} label={t} semitones={capo + tuning} />
  const beforeChart = <>
    {settings.diagrams && <div className={`song-practice__diagrams-top${settings.pinDiagrams ? ' is-pinned' : ''}`}>{diagrams}</div>}
    <p className="song-practice__sounding" translate="no">{t('shapes', { key: display(soundingKey), shape: display(toKey) })}{capo > 0 && ` · ${t('capo')}: ${capo}`}</p>
  </>
  const tools = <aside className="song-practice__aside" aria-label={t('tools')}>
    {isNarrow && <div className="song-practice__aside-head"><strong>{t('tools')}</strong><button ref={close} type="button" aria-label={t('close')} onClick={() => setToolsOpen(false)}><CloseIcon /></button></div>}
    <nav className="song-practice__quick" aria-label={t('tools')}>
      <Link to="/songs" aria-label={t('back')} title={t('back')}><ArrowLeft /></Link>
      <button type="button" onClick={() => window.print()} aria-label={t('print')} title={t('print')}><PrintIcon /></button>
      {favorite}
      {onDownload && !isNarrow && <button type="button" onClick={onDownload} aria-label={t('song:download')} title={t('song:download')}><DownloadIcon /></button>}
      {editHref && <Link to={editHref} aria-label={t('edit')}><PencilIcon /></Link>}
      <button type="button" onClick={share} aria-label={t('share')} title={t('share')}><ShareIcon /></button>
    </nav>
    <div className="song-practice__group">
      <Tool name={t('scroll')} icon={scrolling ? <PauseIcon /> : <PlayIcon />}>
        <Button onClick={() => setScrolling(value => !value)}>{t(scrolling ? 'pause' : 'start')}</Button>
        <label>{t('speed')}<input name="scroll-speed" type="range" min="10" max="120" value={settings.scrollSpeed} onChange={event => update('scrollSpeed', Number(event.target.value))} /></label>
      </Tool>
      <Tool name={t('columns')} icon={<TwoColIcon />} value={t(twoCols && !isNarrow ? 'twoColumns' : 'oneColumn')}>
        <Button aria-pressed={twoCols && !isNarrow} disabled={isNarrow} onClick={onColumnsChange}>{t(twoCols && !isNarrow ? 'oneColumn' : 'twoColumns')}</Button>
        {isNarrow && <p>{t('mobileColumns')}</p>}
        <label>{t('columnHeight')}<input type="range" min="40" max="100" step="5" value={settings.columnHeight} onChange={event => update('columnHeight', Number(event.target.value))} /></label>
        <label>{t('columnWidth')}<input type="range" min="60" max="100" step="5" value={settings.columnWidth} onChange={event => update('columnWidth', Number(event.target.value))} /></label>
        {document.fullscreenEnabled && <Button onClick={toggleFullscreen}>{t(fullscreen ? 'exitFullscreen' : 'fullscreen')}</Button>}
      </Tool>
    </div>
    <div className="song-practice__group">
      <Tool name={t('diagrams')} icon={<MusicIcon />} value={t(settings.instrument)}>
        <label>{t('diagrams')}<select value={settings.instrument} onChange={event => update('instrument', event.target.value)}>{Object.keys(PRACTICE_INSTRUMENTS).map(id => <option key={id} value={id}>{t(id)}</option>)}</select></label>
        <label><input type="checkbox" checked={settings.diagrams} onChange={event => update('diagrams', event.target.checked)} />{t('atStart')}</label>
        <label><input type="checkbox" checked={settings.diagramsEnd} onChange={event => update('diagramsEnd', event.target.checked)} />{t('atEnd')}</label>
        <label><input type="checkbox" checked={settings.pinDiagrams} onChange={event => update('pinDiagrams', event.target.checked)} />{t('pinDiagrams')}</label>
        <label><input type="checkbox" checked={settings.inlineDiagrams} onChange={event => update('inlineDiagrams', event.target.checked)} />{t('inlineDiagrams')}</label>
        <label>{t('diagramSize')}<input type="range" min="80" max="160" step="10" value={settings.diagramScale} onChange={event => update('diagramScale', Number(event.target.value))} /></label>
      </Tool>
      <Tool name={t('key')} icon={<PlusIcon />} value={display(toKey)}>
        <div className="song-practice__key-step"><button type="button" aria-label={t('minus')} onClick={() => onKeyChange(transposeSymPrefer(toKey, -1, flats))}><MinusIcon /></button><KeySelector baseKey={baseKey} valueKey={toKey} onChange={onKeyChange} /><button type="button" aria-label={t('plus')} onClick={() => onKeyChange(transposeSymPrefer(toKey, 1, flats))}><PlusIcon /></button></div>
      </Tool>
      <Tool name={t('capo')} icon={<GearIcon />} value={capo ? t('fret', { number: capo }) : t('noCapo')}>
        <label>{t('capo')}<select value={capo} onChange={event => setCapo(Number(event.target.value))}>{Array.from({ length: 13 }, (_, value) => <option key={value} value={value}>{value ? t('fret', { number: value }) : t('noCapo')}</option>)}</select></label>
      </Tool>
      <Tool name={t('tuning')} icon={<TunerIcon />} value={tuning ? t('down', { number: -tuning }) : t('standard')}>
        <label>{t('tuning')}<select value={tuning} onChange={event => setTuning(Number(event.target.value))}>{[0, -1, -2, -3, -4].map(value => <option key={value} value={value}>{value ? t('down', { number: -value }) : t('standard')}</option>)}</select></label>
      </Tool>
    </div>
    <div className="song-practice__group">
      <Tool name={t('tabs')} icon={<MusicIcon />} value={t(settings.showTabs ? 'show' : 'hide')}><label><input type="checkbox" checked={settings.showTabs} onChange={event => update('showTabs', event.target.checked)} />{t('show')}</label><Link to="/tablature">{t('pages:tablature.title')}</Link></Tool>
      <Tool name={t('text')} icon={<TextFormatIcon />} value={`${settings.fontScale}%`}><label>{t('text')}<input name="chart-text-size" type="range" min="70" max="180" step="5" value={settings.fontScale} onChange={event => update('fontScale', Number(event.target.value))} /></label></Tool>
      <Tool name={t('notation')} icon={<TextFormatIcon />} value={notation === 'solfege' ? 'Do Re Mi' : 'C D E'}><label>{t('notation')}<select value={notation} onChange={event => { setNotation(event.target.value); setChordStyle(event.target.value) }}><option value="letters">C D E F G A B</option><option value="solfege">Do Re Mi Fa Sol La Si</option></select></label></Tool>
      <div className="song-practice__tool-body"><Button aria-pressed={showChords} onClick={onChordsChange} leftIcon={<EyeIcon />}>{t('song:toggleChords')}</Button></div>
      <Tool name={t('strumming')} icon={<MusicIcon />} value={t(settings.showStrumming ? 'show' : 'hide')}><label><input type="checkbox" checked={settings.showStrumming} onChange={event => update('showStrumming', event.target.checked)} />{t('show')}</label>{!hasStrumming && <p>{t('emptyStrumming')}</p>}</Tool>
    </div>
    <div className="song-practice__group song-practice__links"><Link to="/practice"><TunerIcon />{t('pages:practiceTools.tuner')}</Link><Link to="/practice"><MusicIcon />{t('pages:practiceTools.metronome')}</Link></div>
    <button type="button" className="song-practice__reset" onClick={reset}><ResetIcon />{t('reset')}</button>
    <p className="song-practice__saved">{t('saved')}</p>
  </aside>

  const columnPager = twoCols && !isNarrow ? <nav className="song-practice__column-pager" aria-label={t('columns')}><Button disabled={columnPosition.left <= 1} onClick={() => moveColumns(-1)} leftIcon={<ArrowLeft />}>{t('previousColumns')}</Button><Button disabled={columnPosition.left >= columnPosition.max - 1} onClick={() => moveColumns(1)} leftIcon={<ArrowRight />}>{t('nextColumns')}</Button></nav> : null
  return <div ref={root} className="lvm-song-practice" style={{ '--lvm-practice-font-scale': settings.fontScale / 100, '--lvm-practice-diagram-scale': settings.diagramScale / 100, '--lvm-practice-column-height': settings.columnHeight / 100, '--lvm-practice-column-width': `${settings.columnWidth}%` }}>
    {!isNarrow && tools}
    <div className="song-practice__main">
      {children({ notation, showTabs: settings.showTabs, showStrumming: settings.showStrumming, fontScale: settings.fontScale, capo, tuning, beforeChart, afterChart: <>{columnPager}{settings.diagramsEnd && diagrams}</>, onChordSelect: settings.inlineDiagrams ? selectChord : undefined })}
      {notice && <p role="status">{notice}</p>}
    </div>
    {isNarrow && <>
      <button ref={openButton} type="button" className="song-practice__mobile-tools" aria-label={t('tools')} aria-expanded={toolsOpen} onClick={() => setToolsOpen(value => !value)}><GearIcon />{t('tools')}</button>
      {toolsOpen && <dialog ref={dialog} className="song-practice__mobile-panel" aria-label={t('tools')} onCancel={event => { event.preventDefault(); setToolsOpen(false) }}><button type="button" className="song-practice__backdrop" aria-label={t('close')} onClick={() => setToolsOpen(false)} />{tools}</dialog>}
    </>}
    {scrolling && <div className="song-practice__scroll-player"><button type="button" onClick={() => setScrolling(false)} aria-label={t('pause')}><PauseIcon /></button><label>{t('speed')}<input type="range" min="10" max="120" value={settings.scrollSpeed} onChange={event => update('scrollSpeed', Number(event.target.value))} /></label></div>}
    {selectedChord && <dialog ref={chordDialog} className="song-practice__chord-dialog" aria-label={t('diagrams')} onCancel={event => { event.preventDefault(); setSelectedChord(null) }}>
      <button type="button" className="song-practice__dialog-close" onClick={() => setSelectedChord(null)} aria-label={t('close')}><CloseIcon /></button>
      <ChordDiagrams symbols={[selectedChord]} instrument={settings.instrument} display={display} label={t} semitones={capo + tuning} />
    </dialog>}
  </div>
}
