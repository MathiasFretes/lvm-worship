import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MIXER_FILE_BYTES } from '@lavozmisionera/core/music/stemMixer'
import { Button } from '../../components/ui/layout-kit'

const endpoint = 'http://127.0.0.1:4381/separate'
const inputLimit = 64 * 1024 * 1024

function readTracks(bytes) {
  if (bytes.byteLength < 92 || bytes.byteLength > 4 + 2 * MIXER_FILE_BYTES) throw new Error()
  const firstSize = new DataView(bytes).getUint32(0, true)
  const secondSize = bytes.byteLength - 4 - firstSize
  if ([firstSize, secondSize].some(size => size < 44 || size > MIXER_FILE_BYTES)) throw new Error()
  return [bytes.slice(4, firstSize + 4), bytes.slice(firstSize + 4)].map(stem => new Blob([stem], { type: 'audio/wav' }))
}

export default function SeparationPanel({ disabled, onAdd }) {
  const { t } = useTranslation('pages', { keyPrefix: 'mixer.separation' })
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [tracks, setTracks] = useState([])
  const [urls, setUrls] = useState([])
  const pending = useRef(null)
  const previews = useRef(null)

  useEffect(() => () => pending.current?.abort(), [])
  useEffect(() => {
    const next = tracks.map(blob => URL.createObjectURL(blob))
    setUrls(next)
    return () => next.forEach(url => URL.revokeObjectURL(url))
  }, [tracks])

  async function start() {
    if (pending.current || !file) return
    if (file.size < 44 || file.size > inputLimit) {
      setStatus('invalid')
      return
    }
    const controller = new AbortController()
    pending.current = controller
    setTracks([])
    setStatus('running')
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
        targetAddressSpace: 'loopback',
      })
      if (controller.signal.aborted) return
      if (response.status === 409 || response.status === 422) {
        setStatus(response.status === 409 ? 'engineBusy' : 'invalid')
        return
      }
      if (!response.ok) throw new Error()
      const result = readTracks(await response.arrayBuffer())
      if (!controller.signal.aborted) {
        setTracks(result)
        setStatus('ready')
      }
    } catch {
      if (!controller.signal.aborted) setStatus('unavailable')
    } finally {
      if (pending.current === controller) pending.current = null
    }
  }

  async function add() {
    previews.current?.querySelectorAll('audio').forEach(player => player.pause())
    setStatus('adding')
    const files = tracks.map((blob, index) => new File([blob], t(index ? 'backingFile' : 'voiceFile'), { type: blob.type }))
    if (await onAdd(files)) {
      setTracks([])
      setFile(null)
      setStatus('added')
    } else {
      setStatus('addError')
    }
  }

  const running = status === 'running'
  return <details className="lvm-mixer__panel lvm-mixer__separation">
    <summary>{t('title')}</summary>
    <p>{t('help')}</p>
    <label>{t('file')} <input type="file" accept=".wav,audio/wav,audio/x-wav"
      disabled={running || status === 'adding'} onChange={event => {
        setFile(event.target.files?.[0] || null)
        setTracks([])
        setStatus('')
        event.target.value = ''
      }} /></label>
    {file && <p>{file.name}</p>}
    <div className="lvm-mixer__row">
      <Button disabled={!file || running || status === 'adding'} onClick={() => void start()}>{t('start')}</Button>
      {running && <Button onClick={() => {
        pending.current?.abort()
        pending.current = null
        setStatus('cancelled')
      }}>{t('cancel')}</Button>}
    </div>
    {status && <p role="status">{t(status)}</p>}
    {urls.length > 0 && <div className="lvm-mixer__preview" ref={previews}>
      {urls.map((url, index) => <div key={url}>
        <p>{t(index ? 'backing' : 'voice')}</p>
        <audio controls src={url} preload="none" aria-label={t(index ? 'backing' : 'voice')}
          onPlay={event => previews.current?.querySelectorAll('audio').forEach(player => {
            if (player !== event.currentTarget) player.pause()
          })} />
      </div>)}
      <Button variant="primary" disabled={disabled || status === 'adding'} onClick={() => void add()}>{t('add')}</Button>
    </div>}
  </details>
}
