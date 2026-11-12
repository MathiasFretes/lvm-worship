export const MIXER_FILE_BYTES = 24 * 1024 * 1024
const MAX_DECODED_BYTES = 192 * 1024 * 1024
export const MIXER_TRACK_LIMIT = 8

export type MixerBuffer = { duration: number; length: number; numberOfChannels: number }
type Voice = { gain: (value: number) => void; stop: () => void }
export type MixerAudio<Buffer extends MixerBuffer> = {
  clock: () => number
  decode: (file: ArrayBuffer) => Promise<Buffer>
  resume: () => Promise<void>
  play: (buffer: Buffer, at: number, offset: number, duration: number, rate: number, gain: number) => Voice
  close: () => void
}
export type MixerTrack = { id: number; name: string; duration: number; volume: number; muted: boolean; solo: boolean }
export type MixerSnapshot = {
  tracks: MixerTrack[]
  time: number
  duration: number
  rate: number
  playing: boolean
  loop: { start: number; end: number } | null
}

export const emptyMixer: MixerSnapshot = {
  tracks: [], time: 0, duration: 0, rate: 1, playing: false, loop: null,
}

export function createStemMixer<Buffer extends MixerBuffer>(
  audio: MixerAudio<Buffer>,
  onChange: (state: MixerSnapshot) => void,
  onError: () => void,
) {
  const tracks = new Map<number, MixerTrack & { buffer: Buffer }>()
  const voices: { id: number; end: number; voice: Voice }[] = []
  let nextId = 0
  let duration = 0
  let rate = 1
  let loop: MixerSnapshot['loop'] = null
  let position = 0
  let baseTime = 0
  let basePosition = 0
  let nextCycle = Infinity
  let ticker: ReturnType<typeof setInterval> | null = null
  let disposed = false
  let playRequest = 0
  let opening = false

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
      time: currentTime(), duration, rate, playing: ticker !== null, loop,
    })
  }

  function level(track: MixerTrack, solo: boolean) {
    return track.muted || (solo && !track.solo) ? 0 : track.volume / Math.max(1, tracks.size)
  }

  function schedule(at: number, offset: number, end: number) {
    const solo = Array.from(tracks.values()).some(track => track.solo)
    for (const track of tracks.values()) {
      const length = Math.min(track.duration, end) - offset
      if (length <= 0) continue
      const voice = audio.play(track.buffer, at, offset, length, rate, level(track, solo))
      voices.push({ id: track.id, end: at + length / rate, voice })
    }
  }

  function clear() {
    if (ticker !== null) clearInterval(ticker)
    ticker = null
    for (const { voice } of voices) voice.stop()
    voices.length = 0
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
      publish()
    } catch {
      clear()
      onError()
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
      ticker = setInterval(tick, 30)
    } catch {
      clear()
      onError()
    }
    publish()
  }

  function pause() {
    playRequest++
    opening = false
    position = currentTime()
    clear()
    publish()
  }

  function adjust(change: () => void) {
    const wasPlaying = ticker !== null
    pause()
    change()
    if (wasPlaying && duration > 0) start()
    else publish()
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
      })
      return id
    },
    remove(id: number) {
      if (!tracks.has(id)) return
      adjust(() => {
        tracks.delete(id)
        duration = Math.max(0, ...Array.from(tracks.values(), track => track.duration))
        position = Math.min(position, duration)
        if (loop && loop.end > duration) loop = null
      })
    },
    async play() {
      if (disposed || !duration || ticker !== null || opening) return
      const request = ++playRequest
      opening = true
      try {
        await audio.resume()
        if (request === playRequest && !disposed) start()
      } catch {
        if (request === playRequest && !disposed) onError()
      } finally {
        if (request === playRequest) opening = false
      }
    },
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
      adjust(() => { rate = value })
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
      audio.close()
    },
  }
}
