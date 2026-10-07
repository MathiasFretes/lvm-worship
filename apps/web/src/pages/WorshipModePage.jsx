import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs'
import { useChordStyle } from '../hooks/useSettings'
import { useIsMobile } from '../hooks/useIsMobile'
import { buildSongCatalog, resolveGroupEntry, resolveInitialSongLanguage } from '../utils/songs/songCatalog'
import { formatKey, stepsBetween, transposeSymPrefer } from '../utils/chordpro'
import { formatKeyDisplay } from '../utils/chordpro/solfege'
import { applyTheme, currentTheme, toggleTheme } from '../utils/app/theme'
import { ChordLine, InstrumentalRow, VerseView } from '../components/song/ChordRender'
import KeySelector from '../components/KeySelector'
import { decodeSongIds, initialOffsets, loadWorshipEntries, readWorshipSession, setlistReturnUrl, WORSHIP_SESSION_KEY } from './worshipModeModel'
import './worship-mode.css'

const FIT_SIZES = [18, 17, 16, 15, 14]
const storageBool = (key, fallback) => { try { const value = localStorage.getItem(key); return value == null ? fallback : value === '1' } catch { return fallback } }
const storeBool = (key, value) => { try { localStorage.setItem(key, value ? '1' : '0') } catch { /* private mode */ } }
const mobileWidth = () => window.innerWidth < 768
const clockText = (date, twentyFourHours) => twentyFourHours
  ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  : `${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}${date.getHours() >= 12 ? 'pm' : 'am'}`
const timerText = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}:` : ''}${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function Control({ children, label, onClick, disabled = false, active = false, className = '' }) {
  return <button type="button" className={`lvm-worship-control ${active ? 'is-active' : ''} ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>
}

export default function WorshipMode() {
  const { songIds = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const ids = useMemo(() => decodeSongIds(songIds), [songIds])
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const requestedKeys = useMemo(() => (params.get('toKeys') || '').split(',').map((key) => {
    try { return decodeURIComponent(key) } catch { return key }
  }), [params])
  const { songs: catalogSongs, loading } = useSongs()
  const catalog = useMemo(() => buildSongCatalog(catalogSongs), [catalogSongs])
  const language = useMemo(() => resolveInitialSongLanguage(catalog.translationLanguages?.length ? catalog.translationLanguages : catalog.allLanguages), [catalog])
  const chordStyle = useChordStyle()
  const [entries, setEntries] = useState([])
  const [loadedIds, setLoadedIds] = useState('')
  const [index, setIndex] = useState(0)
  const [offsets, setOffsets] = useState([])
  const [baseOffsets, setBaseOffsets] = useState([])
  const [error, setError] = useState('')
  const mobile = useIsMobile(767)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showChords, setShowChords] = useState(true)
  const [halfStep, setHalfStep] = useState(false)
  const [columns, setColumns] = useState(2)
  const [autoFit, setAutoFit] = useState(true)
  const [fontSize, setFontSize] = useState(18)
  const [theme, setTheme] = useState(currentTheme)
  const [showClock, setShowClock] = useState(() => storageBool('worship:showClock', !mobileWidth()))
  const [showTimer, setShowTimer] = useState(() => storageBool('worship:showStopwatch', !mobileWidth()))
  const [twentyFourHours, setTwentyFourHours] = useState(() => storageBool('worship:clock24h', false))
  const [now, setNow] = useState(() => new Date())
  const [elapsed, setElapsed] = useState(() => {
    try {
      const running = sessionStorage.getItem('worship:sw:running') === '1'
      const start = Number(sessionStorage.getItem('worship:sw:startAt') || 0)
      return running && start ? Math.max(0, Math.floor((Date.now() - start) / 1000)) : Number(sessionStorage.getItem('worship:sw:elapsed') || 0)
    } catch { return 0 }
  })
  const [running, setRunning] = useState(() => { try { return sessionStorage.getItem('worship:sw:running') === '1' && Number(sessionStorage.getItem('worship:sw:startAt')) > 0 } catch { return false } })
  const [search, setSearch] = useState('')
  const [hint, setHint] = useState(false)
  const [chromeAwake, setChromeAwake] = useState(true)
  const [pinned, setPinned] = useState(() => storageBool('worship:mobileControlsPinned', false))
  const contentRef = useRef(null)
  const viewportRef = useRef(null)
  const settingsRef = useRef(null)
  const moreRef = useRef(null)
  const startAt = useRef((() => { try { return Number(sessionStorage.getItem('worship:sw:startAt') || 0) } catch { return 0 } })())
  const touch = useRef(null)
  const hintTimer = useRef(null)
  const chromeTimer = useRef(null)

  useEffect(() => {
    applyTheme(currentTheme(), { persist: false })
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (!running) return undefined
    const tick = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startAt.current) / 1000))), 1000)
    return () => clearInterval(tick)
  }, [running])
  useEffect(() => {
    try {
      sessionStorage.setItem('worship:sw:running', running ? '1' : '0')
      sessionStorage.setItem('worship:sw:elapsed', String(elapsed))
      sessionStorage.setItem('worship:sw:startAt', String(startAt.current))
    } catch { /* private mode */ }
  }, [running, elapsed])
  useEffect(() => () => {
    try {
      sessionStorage.removeItem('worship:sw:running')
      sessionStorage.removeItem('worship:sw:elapsed')
      sessionStorage.removeItem('worship:sw:startAt')
    } catch { /* private mode */ }
  }, [])

  useEffect(() => { storeBool('worship:showClock', showClock) }, [showClock])
  useEffect(() => { storeBool('worship:showStopwatch', showTimer) }, [showTimer])
  useEffect(() => { storeBool('worship:clock24h', twentyFourHours) }, [twentyFourHours])
  useEffect(() => { storeBool('worship:mobileControlsPinned', pinned) }, [pinned])
  useEffect(() => { if (!showTimer) { setRunning(false); setElapsed(0); startAt.current = 0 } }, [showTimer])

  useEffect(() => {
    if (loading) return undefined
    let cancelled = false
    const session = readWorshipSession(ids)
    loadWorshipEntries(ids, catalog.byId).then((loaded) => {
      if (cancelled) return
      const initial = initialOffsets(loaded, requestedKeys, params.get('toKey') || '', session)
      setEntries(loaded)
      setLoadedIds(ids.join(','))
      setBaseOffsets(initial.base)
      setOffsets(initial.current)
      const hasExplicitKey = requestedKeys.some(Boolean) || !!params.get('toKey')
      setIndex(Math.max(0, Math.min(loaded.length - 1, hasExplicitKey ? 0 : session?.idx || 0)))
      if (session) {
        setShowChords(session.showChords ?? true)
        setHalfStep(session.halfStep ?? false)
        setColumns(session.cols === 1 ? 1 : 2)
        if (typeof session.fontPx === 'number') setFontSize(session.fontPx)
        setAutoFit(session.autoSize ?? true)
      }
      if (mobileWidth() && !storageBool('worship:swipeHintShown', false)) {
        setHint(true)
        storeBool('worship:swipeHintShown', true)
        hintTimer.current = setTimeout(() => setHint(false), 3000)
      }
    }).catch(() => { if (!cancelled) setError('No se pudo abrir el repertorio.') })
    return () => { cancelled = true; clearTimeout(hintTimer.current) }
  }, [ids, catalog.byId, loading, params, requestedKeys])

  useEffect(() => {
    if (!entries.length || loadedIds !== ids.join(',')) return
    try { sessionStorage.setItem(WORSHIP_SESSION_KEY, JSON.stringify({
      idsString: ids.join(','), idx: index, offsets, baseOffsets, cols: columns,
      fontPx: fontSize, autoSize: autoFit, showChords, halfStep, ts: Date.now(),
    })) } catch { /* private mode */ }
  }, [ids, loadedIds, entries, index, offsets, baseOffsets, columns, fontSize, autoFit, showChords, halfStep])

  const current = entries[index]
  const isVerse = current?.type === 'verse'
  const currentOffset = offsets[index] || 0
  const displayedKey = current && !isVerse ? transposeSymPrefer(current.baseKey, currentOffset, false) : ''
  const flat = /b$/.test(String(current?.baseKey || '').match(/^([A-G][#b]?)/)?.[1] || '')
  const displayKey = displayedKey ? formatKeyDisplay(formatKey(displayedKey, flat ? 'flat' : 'sharp'), chordStyle) : ''
  const catalogGroups = useMemo(() => (catalog.groups || []).map((group) => {
    const entry = resolveGroupEntry(group, language)
    return entry ? { ...entry, searchTitles: group.variants.map((variant) => variant.title || '') } : null
  }).filter(Boolean), [catalog, language])
  const results = useMemo(() => catalogGroups.filter((song) => [song.title, ...song.searchTitles].some((title) => title?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))).slice(0, 5), [catalogGroups, search])

  const wakeChrome = useCallback(() => {
    if (!mobile) return
    setChromeAwake(true)
    clearTimeout(chromeTimer.current)
    if (!pinned && !settingsOpen && !moreOpen) chromeTimer.current = setTimeout(() => setChromeAwake(false), 5000)
  }, [mobile, pinned, settingsOpen, moreOpen])
  useEffect(() => { wakeChrome(); return () => clearTimeout(chromeTimer.current) }, [wakeChrome])
  const dimmed = mobile && !pinned && !chromeAwake && !settingsOpen && !moreOpen

  useEffect(() => {
    const panel = settingsOpen ? settingsRef.current : moreOpen ? moreRef.current : null
    if (!panel) return undefined
    const returnFocus = document.activeElement
    const controls = () => [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')]
    controls()[0]?.focus()
    const onDialogKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSettingsOpen(false)
        setMoreOpen(false)
      }
      if (event.key !== 'Tab') return
      const available = controls()
      if (!available.length) return
      const first = available[0]
      const last = available.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onDialogKey)
    return () => { document.removeEventListener('keydown', onDialogKey); returnFocus?.focus?.() }
  }, [settingsOpen, moreOpen])

  const move = useCallback((direction) => {
    setIndex((value) => Math.max(0, Math.min(entries.length - 1, value + direction)))
    setSearch('')
    contentRef.current?.scrollTo?.(0, 0)
  }, [entries.length])
  const changeKey = useCallback((direction) => {
    if (isVerse || !current) return
    setOffsets((previous) => previous.map((value, at) => at === index ? (value || 0) + direction * (halfStep ? 1 : 2) : value))
  }, [current, halfStep, index, isVerse])
  const setKey = (key) => setOffsets((previous) => previous.map((value, at) => at === index ? stepsBetween(current.baseKey, key) : value))
  const resetKey = () => setOffsets((previous) => previous.map((value, at) => at === index ? baseOffsets[index] || 0 : value))
  useEffect(() => {
    const onKey = (event) => {
      if (/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '') || settingsOpen || moreOpen) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault()
        move(event.key === 'ArrowRight' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move, settingsOpen, moreOpen])

  const onTouchStart = (event) => {
    const point = event.changedTouches?.[0]
    if (point) touch.current = { x: point.clientX, y: point.clientY, at: Date.now(), scrollTop: contentRef.current?.scrollTop || 0 }
    wakeChrome()
  }
  const onTouchEnd = (event) => {
    const point = event.changedTouches?.[0]
    const origin = touch.current
    if (!point || !origin || settingsOpen || moreOpen) return
    const dx = point.clientX - origin.x
    const dy = point.clientY - origin.y
    const duration = Date.now() - origin.at
    if (duration < 800 && Math.abs(dx) > Math.max(70, Math.abs(dy) * 1.7)) move(dx < 0 ? 1 : -1)
    else if (duration < 550 && Math.abs(dy) > Math.max(120, Math.abs(dx) * 2.2) && origin.y > 80 && !(dy > 0 && origin.scrollTop <= 2)) changeKey(dy < 0 ? 1 : -1)
    wakeChrome()
  }

  const addSong = (song) => {
    const updated = [...ids]
    updated.splice(index + 1, 0, song.id)
    setSearch('')
    setMoreOpen(false)
    navigate(`/worship/${updated.map(encodeURIComponent).join(',')}`)
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else viewportRef.current?.requestFullscreen?.()
  }
  const toggleTimer = () => {
    if (running) setRunning(false)
    else { startAt.current = Date.now() - elapsed * 1000; setRunning(true) }
  }
  const resetTimer = () => { setRunning(false); setElapsed(0); startAt.current = 0 }

  useEffect(() => {
    if (!autoFit || !current) return
    const content = contentRef.current
    if (!content) return
    const fit = () => {
      const available = content.clientHeight
      for (const size of FIT_SIZES) {
        content.style.fontSize = `${size}px`
        if (!available || content.scrollHeight <= available) { setFontSize(size); return }
      }
      setFontSize(FIT_SIZES.at(-1))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [autoFit, current, columns, showChords])

  if (!ids.length) return <main className="lvm-worship-empty"><h1>Worship Mode</h1><p>Seleccioná canciones desde el repertorio.</p><button onClick={() => navigate('/setlist')}>Volver a repertorios</button></main>

  return <main className="lvm-worship-mode worship__viewport" ref={viewportRef} onPointerDownCapture={wakeChrome} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
    <header className={`lvm-worship-header ${dimmed ? 'is-dimmed' : ''}`}>
      <Control label="Back to setlist" onClick={() => navigate(setlistReturnUrl(ids, requestedKeys))}>←</Control>
      <div className="lvm-worship-heading">
        <div className="lvm-worship-heading__line">
          {showClock && <time aria-label="Clock">{clockText(now, twentyFourHours)}</time>}
          <h1 title={current?.title || ''}>{current?.title || (loading ? 'Cargando…' : 'Repertorio')}</h1>
          {showTimer && <div className="lvm-worship-timer" aria-label="Stopwatch"><span>{timerText(elapsed)}</span>{!mobile && <><Control label={running ? 'Stop stopwatch' : 'Start stopwatch'} onClick={toggleTimer}>{running ? 'Ⅱ' : '▶'}</Control><Control label="Reset stopwatch" onClick={resetTimer} disabled={!elapsed}>↺</Control></>}</div>}
        </div>
        {current && !isVerse && <p className="lvm-worship-key">Key: {displayKey}{displayedKey !== current.baseKey && <> · Original: {formatKeyDisplay(current.baseKey, chordStyle)}</>}</p>}
      </div>
      <Control label="Open settings" onClick={() => setSettingsOpen(true)}>⚙</Control>
    </header>

    <div className="worship__content lvm-worship-content" ref={contentRef} style={{ fontSize: `${fontSize}px`, '--worship-columns': isVerse || mobile ? 1 : columns }}>
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !current && <p role="status">No se encontraron canciones o versículos para este repertorio.</p>}
      {current?.type === 'verse' ? <VerseView sections={current.sections} rtl={!!current.rtl} /> : current?.sections?.map((section, sectionIndex) => <section className="lvm-worship-section" key={sectionIndex}>
        {section.label && <h2 className="section">[{section.label}]</h2>}
        {section.lines.map((line, lineIndex) => line.instrumental
          ? showChords && <InstrumentalRow key={lineIndex} spec={line.instrumental} steps={currentOffset} preferFlat={flat} split={columns === 2} chordStyle={chordStyle} />
          : line.comment ? <div className="comment" key={lineIndex}>{line.plain}</div>
            : <ChordLine key={lineIndex} plain={line.plain} chords={line.chords} steps={currentOffset} preferFlat={flat} showChords={showChords} chordStyle={chordStyle} />)}
      </section>)}
    </div>

    <div className={`lvm-worship-toolbar ${dimmed ? 'is-dimmed' : ''}`} role="toolbar" aria-label="Worship controls">
      <Control label="Lower key" onClick={() => changeKey(-1)} disabled={isVerse}>↓{!mobile && <span> Key Down</span>}</Control>
      <Control label="Raise key" onClick={() => changeKey(1)} disabled={isVerse}>↑{!mobile && <span> Key Up</span>}</Control>
      {!mobile && <Control label="Reset key" onClick={resetKey} disabled={isVerse}>↺ Reset</Control>}
      {!mobile && <div className="lvm-worship-search"><input aria-label="Add song by title" placeholder="Agregar canción…" value={search} onChange={(event) => setSearch(event.target.value)} />{search.trim() && <div className="lvm-worship-results" role="listbox">{results.map((song) => <button role="option" aria-selected="false" key={song.id} onClick={() => addSong(song)}>+ {song.title}</button>)}</div>}</div>}
      {!mobile && <><Control label="Toggle chords" onClick={() => setShowChords((value) => !value)} disabled={isVerse}>Acordes {showChords ? '✓' : ''}</Control><Control label="Smaller font" onClick={() => { setAutoFit(false); setFontSize((size) => Math.max(10, size - 1)) }}>A−</Control><Control label="Larger font" onClick={() => { setAutoFit(false); setFontSize((size) => Math.min(40, size + 1)) }}>A+</Control></>}
      <Control label="Previous song" onClick={() => move(-1)} disabled={index === 0}>←{!mobile && <span> BACK</span>}</Control>
      <span className="lvm-worship-position">{entries.length ? index + 1 : 0}/{entries.length}</span>
      <Control label={mobile ? 'Next song' : 'NEXT song'} onClick={() => move(1)} disabled={index >= entries.length - 1}>{!mobile && <span>NEXT </span>}→</Control>
      {mobile && <Control label="More controls" onClick={() => setMoreOpen(true)}>⋯</Control>}
    </div>

    {settingsOpen && <div className="lvm-worship-overlay" role="presentation"><button className="lvm-worship-overlay__backdrop" aria-label="Close settings" onClick={() => setSettingsOpen(false)} /><aside ref={settingsRef} className="lvm-worship-panel" role="dialog" aria-modal="true" aria-label="Settings"><div className="lvm-worship-panel__head"><h2>Configuración</h2><Control label="Close" onClick={() => setSettingsOpen(false)}>×</Control></div>
      <label><span>Tema</span><button onClick={() => setTheme(toggleTheme())} aria-label="Toggle dark mode">{theme === 'dark' ? 'Claro' : 'Oscuro'}</button></label>
      {!isVerse && <label><span>Acordes</span><input type="checkbox" aria-label="Toggle chords" checked={showChords} onChange={(event) => setShowChords(event.target.checked)} /></label>}
      <label><span>Reloj</span><input type="checkbox" aria-label="Show clock" checked={showClock} onChange={(event) => setShowClock(event.target.checked)} /></label>
      <label><span>Temporizador</span><input type="checkbox" aria-label="Show timer" checked={showTimer} onChange={(event) => setShowTimer(event.target.checked)} /></label>
      <label><span>Formato de hora</span><select aria-label="Clock format" value={twentyFourHours ? '24' : '12'} onChange={(event) => setTwentyFourHours(event.target.value === '24')}><option value="12">12 horas</option><option value="24">24 horas</option></select></label>
      {!mobile && !isVerse && <label><span>Columnas</span><select aria-label="Columns" value={columns} onChange={(event) => { setAutoFit(false); setColumns(Number(event.target.value)) }}><option value="1">1</option><option value="2">2</option></select></label>}
      {!isVerse && <><label><span>Semitono</span><input type="checkbox" checked={halfStep} onChange={(event) => setHalfStep(event.target.checked)} /></label><label><span>Tonalidad</span><KeySelector baseKey={current?.baseKey || 'C'} valueKey={displayedKey} disabled={!current} onChange={setKey} /></label><button onClick={resetKey}>Restablecer tonalidad</button></>}
      <label><span>Pantalla completa</span><button aria-label="Toggle fullscreen" onClick={toggleFullscreen}>Alternar</button></label>
      <button className="lvm-worship-done" onClick={() => setSettingsOpen(false)}>Listo</button>
    </aside></div>}

    {mobile && moreOpen && <div className="lvm-worship-overlay" role="presentation"><button className="lvm-worship-overlay__backdrop" aria-label="Close controls" onClick={() => setMoreOpen(false)} /><aside ref={moreRef} className="lvm-worship-panel lvm-worship-panel--bottom" role="dialog" aria-modal="true" aria-label="Worship controls"><div className="lvm-worship-panel__head"><h2>Controles</h2><button onClick={() => setMoreOpen(false)}>Done</button></div>
      <button aria-label="Toggle clock" onClick={() => setShowClock((value) => !value)}>Reloj: {showClock ? 'Sí' : 'No'}</button>
      <button aria-label="Toggle timer" onClick={() => setShowTimer((value) => !value)}>Temporizador: {showTimer ? 'Sí' : 'No'}</button>
      {!isVerse && <><button aria-label="Toggle chords" onClick={() => setShowChords((value) => !value)}>Acordes: {showChords ? 'Sí' : 'No'}</button><button aria-label="Reset key" onClick={resetKey}>Restablecer tonalidad</button></>}
      <button aria-label="Smaller font" onClick={() => { setAutoFit(false); setFontSize((size) => Math.max(10, size - 1)) }}>A− Reducir texto</button>
      <button aria-label="Larger font" onClick={() => { setAutoFit(false); setFontSize((size) => Math.min(40, size + 1)) }}>A+ Ampliar texto</button>
      {showTimer && <><button aria-label={running ? 'Stop stopwatch' : 'Start stopwatch'} onClick={toggleTimer}>{running ? 'Pausar' : 'Iniciar'} temporizador</button><button aria-label="Reset stopwatch" onClick={resetTimer} disabled={!elapsed}>Reiniciar temporizador</button></>}
      <button aria-label="Toggle auto-dim" onClick={() => setPinned((value) => !value)}>Controles siempre visibles: {pinned ? 'Sí' : 'No'}</button>
      <input aria-label="Quick add song" placeholder="Agregar canción…" value={search} onChange={(event) => setSearch(event.target.value)} />
      {search.trim() && results.map((song) => <button key={song.id} aria-label={`Add ${song.title}`} onClick={() => addSong(song)}>+ {song.title}</button>)}
    </aside></div>}
    {mobile && hint && <div className="worship__hint" role="status">Swipe left/right for songs · up/down for key</div>}
  </main>
}
