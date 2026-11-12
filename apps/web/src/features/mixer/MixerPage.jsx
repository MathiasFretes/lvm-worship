import React, { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createStemMixer, emptyMixer, MIXER_FILE_BYTES, MIXER_TRACK_LIMIT } from '@lavozmisionera/core/music/stemMixer'
import { Button, PageHeader } from '../../components/ui/layout-kit'
import './mixer.css'

function browserAudio() {
  const audio = new AudioContext()
  return {
    clock: () => audio.currentTime,
    decode: bytes => audio.decodeAudioData(bytes),
    resume: () => audio.resume(),
    close: () => { void audio.close().catch(() => {}) },
    play(buffer, at, offset, duration, rate, volume) {
      const source = audio.createBufferSource()
      const gain = audio.createGain()
      source.buffer = buffer
      source.playbackRate.value = rate
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(audio.destination)
      source.start(at, offset, duration)
      return {
        gain: value => gain.gain.setTargetAtTime(value, audio.currentTime, 0.008),
        stop: () => {
          gain.disconnect()
          source.disconnect()
          source.stop()
        },
      }
    },
  }
}

export default function MixerPage() {
  const { t } = useTranslation('pages', { keyPrefix: 'mixer' })
  const [state, setState] = useState(emptyMixer)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [start, setStart] = useState('0')
  const [end, setEnd] = useState('')
  const [scrub, setScrub] = useState(null)
  const scrubbing = useRef(false)
  const mixer = useRef(null)
  const picker = useRef(null)
  const active = useRef(false)
  const importing = useRef(false)

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      mixer.current?.dispose()
      mixer.current = null
    }
  }, [])

  async function importFiles(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length || importing.current) return
    importing.current = true
    setBusy(true)
    setError('')
    const failures = []
    try {
      mixer.current ??= createStemMixer(browserAudio(), setState, () => setError(t('audioError')))
      const engine = mixer.current
      for (const file of files) {
        if (!active.current) break
        try {
          if (file.size > MIXER_FILE_BYTES || !await engine.add(file.name, await file.arrayBuffer())) failures.push(file.name)
        } catch {
          failures.push(file.name)
        }
      }
      if (active.current && failures.length) setError(t('importError', { files: failures.join(', ') }))
    } catch {
      if (active.current) setError(t('audioError'))
    } finally {
      importing.current = false
      if (active.current) setBusy(false)
    }
  }

  function applyLoop() {
    const valid = start.trim() && mixer.current?.setLoop(Number(start), end.trim() ? Number(end) : state.duration)
    setError(valid ? '' : t('loopError'))
  }

  function finishScrub(event) {
    if (!scrubbing.current) return
    scrubbing.current = false
    mixer.current?.seek(Number(event.currentTarget.value))
    setScrub(null)
  }

  return (
    <section className="container lvm-mixer">
      <Helmet><title>{t('title')} | LVM Worship</title></Helmet>
      <Button as={Link} to="/songs" variant="ghost">{t('back')}</Button>
      <PageHeader title={t('title')} subtitle={t('description')} actions={<>
        <input ref={picker} type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac" multiple hidden onChange={importFiles} />
        <Button variant="primary" disabled={busy || state.tracks.length >= MIXER_TRACK_LIMIT}
          onClick={() => picker.current?.click()}>{t(busy ? 'loading' : 'import')}</Button>
      </>} />
      {error && <p role="alert">{error}</p>}
      {state.tracks.length > 0 ? <>
        <section className="lvm-mixer__panel" aria-label={t('transport')}>
          <div className="lvm-mixer__row">
            <Button variant="primary" onClick={() => state.playing ? mixer.current.pause() : void mixer.current.play()}>
              {t(state.playing ? 'pause' : 'play')}
            </Button>
            <Button onClick={() => mixer.current.stop()}>{t('stop')}</Button>
            <label>{t('speed')} <select value={state.rate} onChange={event => mixer.current.setRate(Number(event.target.value))}>
              {[0.5, 0.75, 1, 1.25, 1.5].map(rate => <option key={rate} value={rate}>{rate * 100}%</option>)}
            </select></label>
          </div>
          <label className="lvm-mixer__timeline">
            <span>{t('position')} <output>{(scrub ?? state.time).toFixed(1)} / {state.duration.toFixed(1)} s</output></span>
            <input type="range" min="0" max={state.duration} step="any" value={scrub ?? state.time}
              aria-label={t('position')} aria-valuetext={`${(scrub ?? state.time).toFixed(1)} s`}
              onPointerDown={event => {
                scrubbing.current = true
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerUp={finishScrub} onBlur={finishScrub}
              onPointerCancel={() => { scrubbing.current = false; setScrub(null) }}
              onChange={event => {
                const value = Number(event.target.value)
                if (scrubbing.current) setScrub(value)
                else mixer.current.seek(value)
              }} />
          </label>
          <div className="lvm-mixer__row">
            <label>{t('start')} <input type="number" min="0" step="0.1" value={start} onChange={event => setStart(event.target.value)} /></label>
            <label>{t('end')} <input type="number" min="0" step="0.1" value={end} placeholder={state.duration.toFixed(1)} onChange={event => setEnd(event.target.value)} /></label>
            <Button onClick={applyLoop}>{t('apply')}</Button>
            <Button disabled={!state.loop} onClick={() => { mixer.current.clearLoop(); setError('') }}>{t('clear')}</Button>
          </div>
          {state.loop && <p>{t('loop', { start: state.loop.start.toFixed(1), end: state.loop.end.toFixed(1) })}</p>}
        </section>
        <ul className="lvm-mixer__tracks">
          {state.tracks.map(track => <li className="lvm-mixer__panel" key={track.id}>
            <h2>{track.name}</h2>
            <label className="lvm-mixer__timeline">
              <span>{t('volume')} {Math.round(track.volume * 100)}%</span>
              <input type="range" min="0" max="1" step="0.01" value={track.volume}
                aria-label={t('volumeFor', { name: track.name })} aria-valuetext={`${Math.round(track.volume * 100)}%`}
                onChange={event => mixer.current.update(track.id, { volume: Number(event.target.value) })} />
            </label>
            <div className="lvm-mixer__row">
              <Button aria-pressed={track.muted} variant={track.muted ? 'primary' : 'secondary'}
                onClick={() => mixer.current.update(track.id, { muted: !track.muted })}>{t(track.muted ? 'muted' : 'mute')}</Button>
              <Button aria-pressed={track.solo} variant={track.solo ? 'primary' : 'secondary'}
                onClick={() => mixer.current.update(track.id, { solo: !track.solo })}>{t('solo')}</Button>
              <Button aria-label={t('removeFor', { name: track.name })} variant="ghost"
                onClick={() => mixer.current.remove(track.id)}>{t('remove')}</Button>
            </div>
          </li>)}
        </ul>
      </> : <p>{t('empty')}</p>}
    </section>
  )
}
