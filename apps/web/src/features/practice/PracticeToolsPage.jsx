import React, { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { clampBpm, MAX_BPM, MIN_BPM, TIME_SIGNATURES } from '@lavozmisionera/core/music/metronomePattern'
import { METRONOME_COUNT_IN, METRONOME_DIVISIONS } from '@lavozmisionera/core/music/metronomeClock'
import { createTapTempo } from '@lavozmisionera/core/music/tapTempo'
import { STANDARD_TUNING, stringReading } from '@lavozmisionera/core/music/tunerNotes'
import { Button, Card, Input, PageHeader } from '../../components/ui/layout-kit'
import { openMetronome, openTuner } from './browserPracticeAudio'
import './practiceTools.css'

function closeSession(session) {
  session?.stop?.()
  session?.stream?.getTracks().forEach(track => track.stop())
  if (session?.audio) void session.audio.close().catch(() => {})
}

export default function PracticeToolsPage() {
  const { t, i18n } = useTranslation('pages')
  const [bpm, setBpm] = useState('100')
  const [meter, setMeter] = useState('4/4')
  const [accent, setAccent] = useState(true)
  const [pulse, setPulse] = useState(null)
  const [division, setDivision] = useState(1)
  const [countIn, setCountIn] = useState(0)
  const [frequency, setFrequency] = useState(null)
  const [lock, setLock] = useState(null)
  const [mode, setMode] = useState(null)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState(null)
  const session = useRef(null)
  const tapTempo = useRef(null)
  const settings = useRef({})
  const tempo = bpm === '' ? 100 : clampBpm(Number(bpm))
  settings.current = { bpm: tempo, meter, accent, division, countIn }
  const beats = TIME_SIGNATURES.find(signature => signature.id === meter).beats
  const reading = frequency ? stringReading(frequency, lock) : null
  const cents = reading ? Math.round(reading.cents) : 0
  const direction = Math.abs(cents) <= 4 ? 'inTune' : cents > 0 ? 'sharp' : 'flat'
  const number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 })

  useEffect(() => () => {
    const active = session.current
    session.current = null
    closeSession(active)
  }, [])

  function stop() {
    const active = session.current
    session.current = null
    closeSession(active)
    setOpening(false)
    setMode(null)
    setPulse(null)
    setFrequency(null)
  }

  async function start(nextMode) {
    stop()
    setError(null)
    if (nextMode === 'tuner' && !navigator.mediaDevices?.getUserMedia) {
      setError({ mode: nextMode, key: 'micUnavailable' })
      return
    }
    const active = {}
    session.current = active
    setMode(nextMode)
    setOpening(true)
    try {
      active.audio = new AudioContext()
      await active.audio.resume()
      if (session.current !== active) return
      if (nextMode === 'tuner') {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
        if (session.current !== active) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        active.stream = stream
        stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
          if (session.current !== active) return
          stop()
          setError({ mode: nextMode, key: 'micUnavailable' })
        }, { once: true }))
        active.stop = openTuner(active.audio, stream, setFrequency)
      } else {
        active.stop = openMetronome(active.audio, () => settings.current, setPulse)
      }
      setOpening(false)
    } catch (failure) {
      if (session.current !== active) return
      stop()
      setError({ mode: nextMode, key: failure.name === 'NotAllowedError' && nextMode === 'tuner' ? 'micDenied' : 'audioError' })
    }
  }

  function tap() {
    tapTempo.current ??= createTapTempo()
    const result = tapTempo.current.tap(performance.now(), beats - 1)
    if (result !== null) setBpm(String(clampBpm(result)))
  }

  const label = key => t(`practiceTools.${key}`)
  return (
    <div className="container lvm-practice">
      <Helmet><title>{label('title')} · LVM Worship</title></Helmet>
      <PageHeader title={label('title')} />
      <nav className="lvm-practice__row" aria-label={label('title')}>
        <Button as={Link} to="/songs">{t('songs.title')}</Button>
        <Button as={Link} to="/tablature">{t('tablature.title')}</Button>
        <Button as={Link} to="/score">{t('score.title')}</Button>
        <Button as={Link} to="/mixer">{t('mixer.title')}</Button>
      </nav>
      <div className="lvm-practice__grid">
        <Card as="section" className="lvm-practice__card" aria-labelledby="practice-metronome">
          <h2 id="practice-metronome">{label('metronome')}</h2>
          <div className="lvm-practice__beats" aria-hidden="true">
            {Array.from({ length: beats }, (_, index) => (
              <span key={index} className={pulse?.beat === index ? 'is-current' : undefined}>{index + 1}</span>
            ))}
          </div>
          <div className="lvm-practice__row">
            <label>{label('division')} <select value={division} onChange={event => setDivision(Number(event.target.value))}>
              {METRONOME_DIVISIONS.map(value => <option key={value} value={value}>{value}×</option>)}
            </select></label>
            <label>{label('countIn')} <select value={countIn} disabled={mode === 'metronome'} onChange={event => setCountIn(Number(event.target.value))}>
              {METRONOME_COUNT_IN.map(value => <option key={value} value={value}>{label(`countIn${value}`)}</option>)}
            </select></label>
          </div>
          <div className="lvm-practice__row">
            <Input label={label('tempo')} type="number" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={event => setBpm(event.target.value)} onBlur={() => setBpm(String(tempo))} />
            <label>{label('meter')} <select value={meter} onChange={event => setMeter(event.target.value)}>
              {TIME_SIGNATURES.map(({ id }) => <option key={id}>{id}</option>)}
            </select></label>
          </div>
          <label className="lvm-practice__check"><input type="checkbox" checked={accent} onChange={event => setAccent(event.target.checked)} />{label('accent')}</label>
          <div className="lvm-practice__row">
            <Button variant="primary" onClick={() => mode === 'metronome' ? stop() : void start('metronome')}>{label(mode === 'metronome' ? 'stop' : 'start')}</Button>
            <Button onClick={tap}>{label('tapTempo')}</Button>
          </div>
          <p role="status">{mode === 'metronome' && !opening && (pulse?.remaining ?? countIn) > 0
            ? `${label('countIn')} · ${label(`countIn${pulse?.remaining ?? countIn}`)}`
            : label(mode !== 'metronome' ? 'stopped' : opening ? 'opening' : 'running')}</p>
          {error?.mode === 'metronome' && <p role="alert">{label(error.key)}</p>}
        </Card>
        <Card as="section" className="lvm-practice__card" aria-labelledby="practice-tuner">
          <h2 id="practice-tuner">{label('tuner')}</h2>
          <p>{label('standard')}</p>
          <div className="lvm-practice__row" role="group" aria-label={label('tunerMode')}>
            <Button aria-pressed={!lock} onClick={() => setLock(null)}>{label('automatic')}</Button>
            {STANDARD_TUNING.map(string => <Button key={string.name} aria-pressed={lock === string} onClick={() => setLock(string)}>{string.name}</Button>)}
          </div>
          <meter aria-label={label('deviation')} min="-50" max="50" low="-4" high="4" optimum="0" value={Math.max(-50, Math.min(50, cents))} hidden={!reading} />
          <p role="status">{reading
            ? `${reading.string.name} · ${label(direction)}`
            : label(mode !== 'tuner' ? 'micOff' : opening ? 'opening' : 'pluck')}</p>
          {reading && <p>{number.format(frequency)} Hz · {cents > 0 ? '+' : ''}{number.format(cents)}¢</p>}
          <div className="lvm-practice__row">
            <Button variant="primary" onClick={() => mode === 'tuner' ? stop() : void start('tuner')}>{label(mode === 'tuner' ? 'stopMic' : 'startMic')}</Button>
          </div>
          {error?.mode === 'tuner' && <p role="alert">{label(error.key)}</p>}
        </Card>
      </div>
    </div>
  )
}
