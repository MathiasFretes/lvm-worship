import React, { useEffect, useRef, useState } from 'react'
import { transposeSymPrefer } from '../../utils/chordpro'
import { formatChord } from '../../utils/chordpro/solfege'
import { transposeInstrumental, formatInstrumental } from '../../utils/songs/instrumental'
import { buildChordRowsLayout } from '../../utils/songs/chordLineLayout'

export function InstrumentalLine({ spec, steps, split, preferFlat }) {
  const inst = transposeInstrumental(spec, steps, preferFlat)
  const rows = formatInstrumental(inst, { split })
  if (!rows.length) return null
  return (
    <div style={{ marginBottom: 10 }}>
      {rows.map((line, idx) => (
        <div
          key={idx}
          style={{
            whiteSpace: 'pre',
            fontFamily: 'var(--lvm-font-chords)',
            fontWeight: 700,
            fontSize: 'inherit',
            lineHeight: 1.35,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}


export function MeasuredLine({ plain, chords, steps, showChords, preferFlat, chordStyle = 'letters', onChordSelect }){
  const hostRef = useRef(null)
  const canvasRef = useRef(null)
  const [state, setState] = useState({ rows: [{ text: '', offsets: [] }], padTop: 0 })
  const [measureKey, setMeasureKey] = useState(0)

  useEffect(()=>{
    if(!hostRef.current) return

    // Ensure canvas
    if(!canvasRef.current){
      const cv = document.createElement('canvas')
      cv.width = 1; cv.height = 1
      canvasRef.current = cv
    }
    const ctx = canvasRef.current.getContext('2d')

    // Grab computed styles from the visible lyrics node
    const lyr = hostRef.current.querySelector('.lyrics')
    if (!ctx || !lyr) {
      setState({ rows: [{ text: plain || '', offsets: [] }], padTop: 0 })
      return
    }
    const cs = window.getComputedStyle(lyr)

    // Lyrics font for width measurement
    const lyricFont = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const hostW = hostRef.current.getBoundingClientRect().width || 0

    // Measure pixel offsets for each chord and resolve collisions
    const chordFamilyRaw = window.getComputedStyle(hostRef.current).getPropertyValue('--lvm-font-chords')
    const chordFontFamily = chordFamilyRaw?.trim() || `'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
    const chordFontSize = cs.fontSize // match lyric size
    const chordFont = `${cs.fontStyle} 700 ${chordFontSize} ${chordFontFamily}`
    const measureLyric = (text = '') => {
      ctx.font = lyricFont
      return ctx.measureText(text).width
    }
    const measureChord = (text = '') => {
      ctx.font = chordFont
      const touchWidth = onChordSelect ? parseFloat(window.getComputedStyle(hostRef.current).getPropertyValue('--lvm-control-h-mobile')) || parseFloat(cs.lineHeight) : 0
      return Math.max(ctx.measureText(text).width, touchWidth)
    }
    const rows = buildChordRowsLayout({
      plain,
      chords: showChords ? chords : [],
      width: hostW,
      measureLyric,
      measureChord,
      transposeSym: (sym) => formatChord(transposeSymPrefer(sym, steps, preferFlat), { style: chordStyle }),
      spaceWidth: measureLyric(' ') || 0,
    })

    // Estimate chord ascent to reserve vertical space
    ctx.font = chordFont
    const chordM = ctx.measureText('Mg')
    const chordAscent = chordM.actualBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8

    const gap = 4
    const padTop = Math.ceil(chordAscent + gap) // reserve space above lyrics
    setState({ rows, padTop })
  }, [plain, chords, steps, showChords, preferFlat, chordStyle, measureKey, onChordSelect])

  // Recalculate on container resize (orientation/viewport changes)
  useEffect(() => {
    const el = hostRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setMeasureKey(k => k + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fallback: window resize
  useEffect(() => {
    function onResize(){ setMeasureKey(k => k + 1) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div ref={hostRef} className="song-practice__chart-line" style={{ marginBottom: 10 }}>
      {(state.rows || []).map((row, rowIndex) => (
        <div
          key={`${rowIndex}-${row.text}`}
          style={{ position:'relative', paddingTop: (showChords && row.offsets.length > 0) ? onChordSelect ? `max(${state.padTop}px, var(--lvm-practice-control-height))` : state.padTop : 0 }}
        >
          {showChords && row.offsets.length > 0 && (
            <div aria-hidden={onChordSelect ? undefined : true} className="chord-layer" style={{position:'absolute', left:0, right:0, top:0}}>
              {row.offsets.map((c, i)=>(
                onChordSelect ? <button key={i} type="button" className="song-practice__inline-chord" onClick={() => onChordSelect(c.sym)} style={{ position: 'absolute', left: `${c.left}px` }}>{c.sym}</button> : <span key={i} style={{
                  position:'absolute',
                  left: `${c.left}px`,
                  fontFamily: 'var(--lvm-font-chords)',
                  fontWeight: 700
                }}>{c.sym}</span>
              ))}
            </div>
          )}
          <div className="lyrics" style={{ whiteSpace: 'pre' }}>{row.text || '\u00a0'}</div>
        </div>
      ))}
    </div>
  )
}
