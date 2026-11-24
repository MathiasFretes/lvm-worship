import { beatEmphasis, beatIntervalSec, beatsInMeasure, MAX_BPM, MIN_BPM, TIME_SIGNATURES, type BeatEmphasis, type TimeSignatureId } from './metronomePattern'

export const MIXER_FILE_BYTES = 24 * 1024 * 1024
const MAX_DECODED_BYTES = 192 * 1024 * 1024
export const MIXER_TRACK_LIMIT = 8

export type MixerBuffer = { duration: number; length: number; numberOfChannels: number }
type Voice = { gain: (value: number) => void; stop: () => void }
export type MixerAudio<Buffer extends MixerBuffer> = {
  clock: () => number
  decode: (file: ArrayBuffer) => Promise<Buffer>
  resume: () => Promise<void>
  prepare: (buffers: Buffer[], stretch: number, cancelled: () => boolean) => Promise<Buffer[] | null>
  play: (buffer: Buffer, at: number, offset: number, duration: number, rate: number, gain: number) => Voice
  click?: (at: number, emphasis: BeatEmphasis) => () => void
  close: () => void
}
export type MixerTrack = { id: number; name: string; duration: number; volume: number; muted: boolean; solo: boolean }
export type MixerMetronome = { enabled: boolean; bpm: number; meter: TimeSignatureId; offset: number }
export const defaultMixerMetronome: MixerMetronome = { enabled: false, bpm: 100, meter: '4/4', offset: 0 }

export function isMixerMetronome(value: unknown): value is MixerMetronome {
  if (!value || typeof value !== 'object') return false
  const { enabled, bpm, meter, offset } = value as Partial<MixerMetronome>
  return typeof enabled === 'boolean' && typeof bpm === 'number' && Number.isInteger(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM &&
    TIME_SIGNATURES.some(signature => signature.id === meter) && typeof offset === 'number' && Number.isFinite(offset) && offset >= 0
}

export type MixerSnapshot = {
  tracks: MixerTrack[]
  time: number
  duration: number
  rate: number
  pitch: number
  preparing: boolean
  playing: boolean
  loop: { start: number; end: number } | null
  metronome: MixerMetronome
}

export const emptyMixer: MixerSnapshot = {
  tracks: [], time: 0, duration: 0, rate: 1, pitch: 0, preparing: false, playing: false, loop: null, metronome: defaultMixerMetronome,
}

export function createStemMixer<Buffer extends MixerBuffer>(
  audio: MixerAudio<Buffer>,
  onChange: (state: MixerSnapshot) => void,
  onError: (reason: 'audio' | 'processing') => void,
) {
  const tracks = new Map<number, MixerTrack & { buffer: Buffer }>()
  const voices: { id: number; end: number; voice: Voice }[] = []
  const segments: { at: number; offset: number; end: number; beat: number }[] = []
  const clicks: { end: number; stop: () => void }[] = []
  let nextId = 0
  let duration = 0
  let rate = 1
  let pitch = 0
  let metronome = defaultMixerMetronome
  let prepared: Map<number, Buffer> | null = null
  let pendingPreparation: Promise<Buffer[] | null> | null = null
  let loop: MixerSnapshot['loop'] = null
  let position = 0
  let baseTime = 0
  let basePosition = 0
  let nextCycle = Infinity
  let ticker: ReturnType<typeof setInterval> | null = null
  let disposed = false
  let playRequest = 0
  let opening = false
  let preparing = false

  const playbackRate = () => 2 ** (pitch / 12)
  const stretchFactor = () => playbackRate() / rate
  const requiresPreparation = () => Math.abs(stretchFactor() - 1) > 1e-6 && !prepared

  function currentTime() {
    if (ticker === null) return position
    const elapsed = Math.max(0, audio.clock() - baseTime) * rate
    const next = basePosition + elapsed
    if (loop && next >= loop.end) return loop.start + (next - loop.end) % (loop.end - loop.start)
    return Math.min(duration, next)
  }

  function publish() {
    if (disposed) return
    onChange({
      tracks: Array.from(tracks.values(), ({ id, name, duration, volume, muted, solo }) => ({ id, name, duration, volume, muted, solo })),
      time: currentTime(), duration, rate, pitch, preparing, playing: ticker !== null, loop, metronome,
    })
  }

  function level(track: MixerTrack, solo: boolean) {
    return track.muted || (solo && !track.solo) ? 0 : track.volume / Math.max(1, tracks.size)
  }

  function schedule(at: number, offset: number, end: number) {
    if (metronome.enabled && audio.click) {
      const beat = Math.max(0, Math.ceil((offset - metronome.offset) / beatIntervalSec(metronome.bpm) - 1e-8))
      segments.push({ at, offset, end, beat })
    }
    const solo = Array.from(tracks.values()).some(track => track.solo)
    const stretch = stretchFactor()
    const sourceRate = playbackRate()
    for (const track of tracks.values()) {
      const length = Math.min(track.duration, end) - offset
      if (length <= 0) continue
      const buffer = prepared?.get(track.id) ?? track.buffer
      const sourceOffset = offset * stretch
      const sourceLength = Math.min(buffer.duration - sourceOffset, length * stretch)
      if (sourceLength <= 0) continue
      const voice = audio.play(buffer, at, sourceOffset, sourceLength, sourceRate, level(track, solo))
      voices.push({ id: track.id, end: at + length / rate, voice })
    }
  }

  function clear() {
    if (ticker !== null) clearInterval(ticker)
    ticker = null
    for (const { voice } of voices) voice.stop()
    voices.length = 0
    for (const click of clicks) click.stop()
    clicks.length = 0
    segments.length = 0
  }

  function scheduleClicks(now: number) {
    const interval = beatIntervalSec(metronome.bpm)
    for (let index = clicks.length - 1; index >= 0; index--) {
      if (clicks[index].end <= now) clicks.splice(index, 1)
    }
    for (const segment of segments) {
      if (segment.at + (segment.end - segment.offset) / rate <= now) continue
      const sourceNow = segment.offset + Math.max(0, now - segment.at) * rate
      segment.beat = Math.max(segment.beat, Math.ceil((sourceNow - metronome.offset) / interval - 1e-8))
      while (true) {
        const sourceTime = metronome.offset + segment.beat * interval
        const time = segment.at + Math.max(0, sourceTime - segment.offset) / rate
        if (sourceTime >= segment.end - 1e-8 || time > now + 0.12) break
        if (time >= now && audio.click) {
          const beat = segment.beat % beatsInMeasure(metronome.meter)
          clicks.push({ end: time + 0.05, stop: audio.click(time, beatEmphasis(metronome.meter, beat, true)) })
        }
        segment.beat++
      }
    }
    while (segments.length && segments[0].at + (segments[0].end - segments[0].offset) / rate <= now) segments.shift()
  }

  function tick() {
    const now = audio.clock()
    try {
      for (let i = voices.length - 1; i >= 0; i--) {
        if (voices[i].end <= now) {
          voices[i].voice.stop()
          voices.splice(i, 1)
        }
      }
      if (loop) {
        const period = (loop.end - loop.start) / rate
        if (nextCycle < now) {
          const elapsed = (now - nextCycle) % period
          schedule(now, loop.start + elapsed * rate, loop.end)
          nextCycle = now + period - elapsed
        }
        while (nextCycle <= now + 0.12) {
          schedule(nextCycle, loop.start, loop.end)
          nextCycle += period
        }
      } else if (currentTime() >= duration) {
        clear()
        position = duration
      }
      scheduleClicks(now)
      publish()
    } catch {
      clear()
      onError('audio')
      publish()
    }
  }

  function start() {
    const end = loop?.end ?? duration
    basePosition = loop && (position < loop.start || position >= loop.end) ? loop.start : position
    if (basePosition >= end) basePosition = 0
    baseTime = audio.clock() + 0.055
    nextCycle = loop ? baseTime + (end - basePosition) / rate : Infinity
    try {
      schedule(baseTime, basePosition, end)
      scheduleClicks(audio.clock())
      ticker = setInterval(tick, 30)
    } catch {
      clear()
      onError('audio')
    }
    publish()
  }

  function pause() {
    playRequest++
    opening = false
    preparing = false
    position = currentTime()
    clear()
    publish()
  }

  function adjust(change: () => void, rebuild = false) {
    const wasPlaying = ticker !== null
    const shouldResume = wasPlaying || opening
    pause()
    change()
    if (rebuild) prepared = null
    if (shouldResume && duration > 0) {
      if (!wasPlaying || requiresPreparation()) void play()
      else start()
    }
    else publish()
  }

  async function play() {
    if (disposed || !duration || ticker !== null || opening) return
    const request = ++playRequest
    const cancelled = () => request !== playRequest || disposed
    opening = true
    const needsProcessing = requiresPreparation()
    let stage: 'audio' | 'processing' = 'audio'
    try {
      if (needsProcessing) {
        preparing = true
        publish()
      }
      await audio.resume()
      if (cancelled()) return
      if (needsProcessing) {
        stage = 'processing'
        if (pendingPreparation) await pendingPreparation.catch(() => null)
        if (cancelled()) return
        const entries = Array.from(tracks.values())
        const job = audio.prepare(entries.map(track => track.buffer), stretchFactor(), cancelled)
        pendingPreparation = job
        let buffers
        try { buffers = await job } finally { if (pendingPreparation === job) pendingPreparation = null }
        if (cancelled()) return
        if (!buffers || buffers.length !== entries.length) throw new Error('Incomplete mixer processing')
        prepared = new Map(entries.map((track, index) => [track.id, buffers[index]]))
      }
      preparing = false
      start()
    } catch {
      if (!cancelled()) onError(stage)
    } finally {
      if (!cancelled()) {
        opening = false
        preparing = false
        publish()
      }
    }
  }

  return {
    async add(name: string, bytes: ArrayBuffer) {
      if (disposed || bytes.byteLength > MIXER_FILE_BYTES || tracks.size >= MIXER_TRACK_LIMIT) return null
      const buffer = await audio.decode(bytes)
      if (disposed || tracks.size >= MIXER_TRACK_LIMIT) return null
      const existingBytes = Array.from(tracks.values()).reduce((sum, track) => sum + track.buffer.length * track.buffer.numberOfChannels * 4, 0)
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 ||
          existingBytes + buffer.length * buffer.numberOfChannels * 4 > MAX_DECODED_BYTES) return null
      const id = nextId++
      adjust(() => {
        tracks.set(id, { id, name, duration: buffer.duration, volume: 1, muted: false, solo: false, buffer })
        duration = Math.max(duration, buffer.duration)
      }, true)
      return id
    },
    remove(id: number) {
      if (!tracks.has(id)) return
      adjust(() => {
        tracks.delete(id)
        duration = Math.max(0, ...Array.from(tracks.values(), track => track.duration))
        position = Math.min(position, duration)
        if (loop && loop.end > duration) loop = null
      }, true)
    },
    play,
    pause,
    stop() {
      pause()
      position = 0
      publish()
    },
    seek(time: number) {
      if (!Number.isFinite(time)) return
      adjust(() => { position = Math.min(duration, Math.max(0, time)) })
    },
    setRate(value: number) {
      if (!Number.isFinite(value) || value < 0.5 || value > 1.5) return
      if (value !== rate) adjust(() => { rate = value }, true)
    },
    setPitch(value: number) {
      if (Number.isInteger(value) && value >= -12 && value <= 12 && value !== pitch) {
        adjust(() => { pitch = value }, true)
      }
    },
    setMetronome(value: MixerMetronome) {
      if (!isMixerMetronome(value)) return
      const { enabled, bpm, meter, offset } = value
      if (enabled === metronome.enabled && bpm === metronome.bpm && meter === metronome.meter && offset === metronome.offset) return
      adjust(() => { metronome = { enabled, bpm, meter, offset } })
    },
    setLoop(start: number, end: number) {
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > duration + 0.001) return false
      const clampedEnd = Math.min(end, duration)
      if (clampedEnd - start < 0.25) return false
      adjust(() => { loop = { start, end: clampedEnd } })
      return true
    },
    clearLoop() { adjust(() => { loop = null }) },
    update(id: number, patch: Partial<Pick<MixerTrack, 'volume' | 'muted' | 'solo'>>) {
      const track = tracks.get(id)
      if (!track) return
      if (patch.volume !== undefined && Number.isFinite(patch.volume)) track.volume = Math.min(1, Math.max(0, patch.volume))
      if (patch.muted !== undefined) track.muted = patch.muted
      if (patch.solo !== undefined) track.solo = patch.solo
      const solo = Array.from(tracks.values()).some(entry => entry.solo)
      for (const { id, voice } of voices) voice.gain(level(tracks.get(id)!, solo))
      publish()
    },
    dispose() {
      if (disposed) return
      disposed = true
      playRequest++
      clear()
      tracks.clear()
      prepared = null
      audio.close()
    },
  }
}
