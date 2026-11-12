import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildTabPlayback, createTabSession, tabLoopMeasures, tabMidiFrequency, tabPlaybackSettings } from '@lavozmisionera/core/music/tablaturePlayback'
import { buildScorePlayback } from '@lavozmisionera/core/music/scorePlayback'
import { Button } from '../../components/ui/layout-kit'
import './tablature.css'

async function openAudio() {
  const audio = new AudioContext()
  try {
    await audio.resume()
  } catch (error) {
    void audio.close().catch(() => {})
    throw error
  }
  return {
    clock: () => audio.currentTime,
    note(at, midi, decay, click, sustain) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = click ? 'sine' : 'triangle'
      oscillator.frequency.setValueAtTime(tabMidiFrequency(midi), at)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.065, at + Math.min(0.006, decay / 4))
      if (sustain) gain.gain.setValueAtTime(0.065, at + decay - Math.min(0.025, decay / 4))
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(at)
      oscillator.stop(at + decay)
      return () => { gain.disconnect(); oscillator.stop() }
    },
    close: () => { void audio.close().catch(() => {}) },
  }
}

export default function TabPlayback({ source, score, onPosition }) {
  const { t } = useTranslation('pages', { keyPrefix: 'tablature.playback' })
  const [status, setStatus] = useState('idle')
  const [tempo, setTempo] = useState('96')
  const [speed, setSpeed] = useState('100')
  const [transpose, setTranspose] = useState('0')
  const [loop, setLoop] = useState(false)
  const [metronome, setMetronome] = useState(false)
  const [first, setFirst] = useState('1')
  const [last, setLast] = useState('')
  const measures = useMemo(() => score ? buildScorePlayback(score) : buildTabPlayback(source), [score, source])
  const session = useMemo(() => createTabSession({ open: openAudio, onPosition, onStatus: setStatus }), [onPosition])
  const range = loop ? tabLoopMeasures(measures, first, last) : measures
  const active = status === 'opening' || status === 'playing' || status === 'paused'
  const canPlay = range.length > 0 && (metronome || range.some(measure => measure.notes.length))

  useEffect(() => () => { session.dispose(); onPosition(null) }, [session, onPosition])
  useEffect(() => { session.stop() }, [session, measures])

  function play() {
    const settings = tabPlaybackSettings(score ? String(score.tempo) : tempo, speed, transpose)
    if (!score) setTempo(String(settings.bpm))
    setSpeed(String(settings.speed))
    setTranspose(String(settings.transpose))
    void session.play(range, settings.bpm, settings.speed, settings.transpose, loop, metronome)
  }

  return (
    <section className="lvm-tablature__transport" aria-label={t(score ? 'scoreTitle' : 'title')}>
      <div className="lvm-tablature__actions">
        {status === 'playing'
          ? <Button variant="primary" onClick={session.pause}>{t('pause')}</Button>
          : <Button variant="primary" onClick={play} disabled={status === 'opening' || !canPlay}>{t('play')}</Button>}
        <Button onClick={session.stop} disabled={!active}>{t('stop')}</Button>
        <label><input type="checkbox" checked={loop} disabled={active} onChange={event => setLoop(event.target.checked)} /> {t('loop')}</label>
        <label><input type="checkbox" checked={metronome} disabled={active} onChange={event => setMetronome(event.target.checked)} /> {t('metronome')}</label>
      </div>
      <div className="lvm-tablature__actions">
        {!score && <label>{t('bpm')} <input type="number" min="30" max="300" value={tempo} disabled={active} onChange={event => setTempo(event.target.value)} /></label>}
        <label>{t('speed')} <input type="number" min="25" max="150" value={speed} disabled={active} onChange={event => setSpeed(event.target.value)} /></label>
        <label>{t('pitch')} <input type="number" min="-12" max="12" value={transpose} disabled={active} onChange={event => setTranspose(event.target.value)} /></label>
      </div>
      {loop && <div className="lvm-tablature__actions">
        <label>{t('first')} <input type="number" min="1" max={measures.length} value={first} disabled={active} onChange={event => setFirst(event.target.value)} /></label>
        <label>{t('last')} <input type="number" min="1" max={measures.length} value={last} placeholder={String(measures.length)} disabled={active} onChange={event => setLast(event.target.value)} /></label>
      </div>}
      <p className="lvm-tablature__playback-help">{t(score ? 'scoreHelp' : 'help')}</p>
      {status === 'error' && <p role="alert">{t('error')}</p>}
      {loop && !range.length && <p role="status">{t('invalidRange')}</p>}
    </section>
  )
}
