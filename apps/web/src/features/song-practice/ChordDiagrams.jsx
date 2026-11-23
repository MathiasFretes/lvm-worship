import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRightIcon, PlayIcon } from '../../components/Icons'
import { chordVoicings, keyboardVoicing, midiFrequency } from './practiceMusic'

function FretDiagram({ voicing }) {
  const frets = voicing.frets
  const start = voicing.position
  const width = 100
  const spacing = 70 / (frets.length - 1)
  return <svg viewBox={`0 0 ${width} 116`} className="song-practice__diagram" aria-hidden="true">
    {Array.from({ length: 5 }, (_, index) => <line key={`f${index}`} x1="15" x2="85" y1={28 + index * 17} y2={28 + index * 17} className={index === 0 && start === 1 ? 'is-nut' : undefined} />)}
    {voicing.barres.map((barre, index) => <line key={`barre${index}`} className="is-barre" x1={15 + barre.start * spacing} x2={15 + barre.end * spacing} y1={28 + (barre.fret - start + 0.5) * 17} y2={28 + (barre.fret - start + 0.5) * 17} />)}
    {frets.map((fret, index) => <g key={index}>
      <line x1={15 + index * spacing} x2={15 + index * spacing} y1="28" y2="96" />
      {fret <= 0 ? <text x={15 + index * spacing} y="19" textAnchor="middle">{fret < 0 ? '×' : '○'}</text>
        : <><circle cx={15 + index * spacing} cy={28 + (fret - start + 0.5) * 17} r="5" /><text className="finger-number" x={15 + index * spacing} y={31 + (fret - start + 0.5) * 17} textAnchor="middle">{voicing.fingers[index]}</text></>}
    </g>)}
    {start > 1 && <text x="4" y="41" textAnchor="middle">{start}</text>}
  </svg>
}

function KeyboardDiagram({ notes }) {
  const first = Math.floor(Math.min(...notes) / 12) * 12
  const octaves = Math.max(1, Math.ceil((Math.max(...notes) - first + 1) / 12))
  const whites = Array.from({ length: octaves * 12 }, (_, index) => first + index).filter(note => ![1, 3, 6, 8, 10].includes(note % 12))
  return <svg viewBox={`0 0 ${whites.length * 12} 65`} className="song-practice__diagram song-practice__diagram--keyboard" aria-hidden="true">
    {whites.map((note, index) => <rect key={note} x={index * 12} y="8" width="12" height="48" className={notes.includes(note) ? 'piano-white is-note' : 'piano-white'} />)}
    {whites.map((note, index) => [0, 2, 5, 7, 9].includes(note % 12) ? <rect key={note} x={index * 12 + 8} y="8" width="8" height="30" className={notes.includes(note + 1) ? 'piano-black is-note' : 'piano-black'} /> : null)}
  </svg>
}

function ChordCard({ symbol, instrument, display, play, label, semitones }) {
  const [variation, setVariation] = useState(0)
  const positions = useMemo(() => chordVoicings(symbol, instrument), [symbol, instrument])
  const keyboard = instrument === 'keyboard'
  const notes = (keyboard ? keyboardVoicing(symbol) : positions[variation]?.notes || []).map(note => note + semitones)
  return <div className="song-practice__chord">
    <strong translate="no">{display(symbol)}</strong>
    {notes.length ? <button type="button" className="song-practice__chord-play" aria-label={label('playChord', { chord: display(symbol) })} onClick={() => play(notes)}>
      {keyboard ? <KeyboardDiagram notes={notes} /> : <FretDiagram voicing={positions[variation]} />}
      <span className="song-practice__play-indicator"><PlayIcon /></span>
    </button> : <span className="song-practice__no-diagram">{label('noDiagram')}</span>}
    {!keyboard && positions.length > 1 && <button type="button" className="song-practice__variation" aria-label={label('nextPosition', { chord: display(symbol) })} onClick={() => setVariation(value => (value + 1) % positions.length)}>
      {variation + 1}/{positions.length} <ChevronRightIcon />
    </button>}
  </div>
}

export default function ChordDiagrams({ symbols, instrument, display, label, semitones = 0 }) {
  const audio = useRef(null)
  const generation = useRef(0)
  const [error, setError] = useState(false)
  useEffect(() => () => {
    generation.current++
    if (audio.current) void audio.current.close().catch(() => {})
    audio.current = null
  }, [])

  async function play(notes) {
    const attempt = ++generation.current
    try {
      const Context = window.AudioContext || window.webkitAudioContext
      if (!Context) throw new Error('Audio unavailable')
      audio.current ??= new Context()
      const context = audio.current
      await context.resume()
      if (attempt !== generation.current) return
      setError(false)
      const volume = 0.12 / Math.max(1, notes.length)
      notes.forEach((note, index) => {
        const start = context.currentTime + index * 0.045
        const oscillator = context.createOscillator()
        const envelope = context.createGain()
        oscillator.type = 'triangle'
        oscillator.frequency.value = midiFrequency(note)
        envelope.gain.setValueAtTime(0, start)
        envelope.gain.linearRampToValueAtTime(volume, start + 0.015)
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + 1.2)
        oscillator.connect(envelope)
        envelope.connect(context.destination)
        oscillator.start(start)
        oscillator.stop(start + 1.25)
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect() }
      })
    } catch { if (attempt === generation.current) setError(true) }
  }

  if (!symbols.length) return null
  return <section className="song-practice__chords" aria-label={label('diagrams')}>
    <div className="song-practice__chord-strip" tabIndex="0" role="group" aria-label={label('diagrams')}>
      {symbols.map(symbol => <ChordCard key={`${instrument}:${symbol}`} {...{ symbol, instrument, display, play, label, semitones }} />)}
    </div>
    {error && <p role="alert">{label('audioError')}</p>}
  </section>
}
