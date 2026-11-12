import React, { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createStemMixer, emptyMixer, MIXER_FILE_BYTES, MIXER_TRACK_LIMIT } from '@lavozmisionera/core/music/stemMixer'
import { makeMixerProject, restoreMixerProject } from '@lavozmisionera/core/music/mixerProject'
import { stretchMixerAudio } from '@lavozmisionera/core/music/stretchMixerAudio'
import { Button, PageHeader } from '../../components/ui/layout-kit'
import { readMixerProject, writeMixerProject } from './mixerStore'
import './mixer.css'

function browserAudio() {
  const audio = new AudioContext()
  return {
    clock: () => audio.currentTime,
    decode: bytes => audio.decodeAudioData(bytes),
    resume: () => audio.resume(),
    prepare: (buffers, stretch, cancelled) => stretchMixerAudio(buffers, stretch, audio.createBuffer.bind(audio), cancelled),
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
  const [restoring, setRestoring] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stored, setStored] = useState(false)
  const [draftStatus, setDraftStatus] = useState('')
  const [draftError, setDraftError] = useState('')
  const [start, setStart] = useState('0')
  const [end, setEnd] = useState('')
  const [scrub, setScrub] = useState(null)
  const scrubbing = useRef(false)
  const mixer = useRef(null)
  const assets = useRef(new Map())
  const picker = useRef(null)
  const active = useRef(false)
  const importing = useRef(false)

  useEffect(() => {
    active.current = true
    let cancelled = false
    let candidate
    async function restore() {
      try {
        const draft = await readMixerProject()
        if (cancelled || !draft) return
        setStored(true)
        let latest = emptyMixer
        candidate = createStemMixer(browserAudio(), next => {
          latest = next
          if (!cancelled && mixer.current === candidate) setState(next)
        }, reason => setDraftError(reason === 'processing' ? 'processingError' : 'audioError'))
        const result = await restoreMixerProject(draft.manifest, draft.files, candidate)
        if (cancelled) return
        assets.current = result.assets
        mixer.current = candidate
        setState(latest)
        if (result.manifest.loop) {
          setStart(String(result.manifest.loop.start))
          setEnd(String(result.manifest.loop.end))
        }
      } catch {
        candidate?.dispose()
        if (!cancelled) setDraftError('restoreError')
      } finally {
        if (!cancelled) setRestoring(false)
      }
    }
    void restore()
    return () => {
      cancelled = true
      active.current = false
      candidate?.dispose()
      mixer.current?.dispose()
      mixer.current = null
      assets.current.clear()
    }
  }, [])

  async function importFiles(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length || importing.current || restoring || saving) return
    importing.current = true
    setBusy(true)
    setError('')
    const failures = []
    try {
      mixer.current ??= createStemMixer(browserAudio(), setState, reason => setDraftError(reason === 'processing' ? 'processingError' : 'audioError'))
      const engine = mixer.current
      for (const file of files) {
        if (!active.current) break
        try {
          const id = file.size <= MIXER_FILE_BYTES ? await engine.add(file.name, await file.arrayBuffer()) : null
          if (id === null) failures.push(file.name)
          else if (active.current && mixer.current === engine) assets.current.set(id, file)
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

  async function saveDraft() {
    if (busy || restoring || saving) return
    setSaving(true)
    setDraftError('')
    setDraftStatus('')
    try {
      const project = makeMixerProject(state, assets.current)
      await writeMixerProject(project)
      if (active.current) {
        setStored(project.files.length > 0)
        setDraftStatus(project.files.length ? 'saved' : 'deleted')
      }
    } catch {
      if (active.current) setDraftError('saveError')
    } finally {
      if (active.current) setSaving(false)
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
        <Button variant="primary" disabled={busy || restoring || saving || state.preparing || state.tracks.length >= MIXER_TRACK_LIMIT}
          onClick={() => picker.current?.click()}>{t(busy ? 'loading' : 'import')}</Button>
        {(stored || state.tracks.length > 0) && <Button disabled={busy || restoring || saving} onClick={() => void saveDraft()}>
          {t(saving ? 'saving' : state.tracks.length ? 'save' : 'deleteSaved')}
        </Button>}
      </>} />
      {error && <p role="alert">{error}</p>}
      {draftError && <p role="alert">{t(draftError)}</p>}
      {draftStatus && <p role="status">{t(draftStatus)}</p>}
      {state.tracks.length > 0 ? <>
        <section className="lvm-mixer__panel" aria-label={t('transport')}>
          <div className="lvm-mixer__row">
            <Button variant="primary" disabled={state.preparing} onClick={() => {
              setDraftError('')
              if (state.playing) mixer.current.pause()
              else void mixer.current.play()
            }}>
              {t(state.preparing ? 'preparing' : state.playing ? 'pause' : 'play')}
            </Button>
            <Button onClick={() => mixer.current.stop()}>{t('stop')}</Button>
            <label>{t('speed')} <select aria-label={t('speed')} disabled={state.preparing} value={state.rate} onChange={event => {
              setDraftError('')
              mixer.current.setRate(Number(event.target.value))
            }}>
              {[0.5, 0.75, 1, 1.25, 1.5].map(rate => <option key={rate} value={rate}>{rate * 100}%</option>)}
            </select></label>
            <label>{t('pitch')} <select aria-label={t('pitch')} disabled={state.preparing} value={state.pitch} onChange={event => {
              setDraftError('')
              mixer.current.setPitch(Number(event.target.value))
            }}>
              {Array.from({ length: 25 }, (_, index) => index - 12).map(pitch => <option key={pitch} value={pitch}>
                {pitch > 0 ? `+${pitch}` : pitch}
              </option>)}
            </select></label>
          </div>
          <label className="lvm-mixer__timeline">
            <span>{t('position')} <output>{(scrub ?? state.time).toFixed(1)} / {state.duration.toFixed(1)} s</output></span>
            <input type="range" min="0" max={state.duration} step="any" value={scrub ?? state.time} disabled={state.preparing}
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
            <Button disabled={state.preparing} onClick={applyLoop}>{t('apply')}</Button>
            <Button disabled={state.preparing || !state.loop} onClick={() => { mixer.current.clearLoop(); setError('') }}>{t('clear')}</Button>
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
              <Button aria-label={t('removeFor', { name: track.name })} variant="ghost" disabled={saving || state.preparing}
                onClick={() => { mixer.current.remove(track.id); assets.current.delete(track.id) }}>{t('remove')}</Button>
            </div>
          </li>)}
        </ul>
      </> : <p role="status">{t(restoring ? 'restoring' : 'empty')}</p>}
    </section>
  )
}
