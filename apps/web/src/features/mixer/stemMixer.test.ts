import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStemMixer, type MixerBuffer, type MixerSnapshot } from '@lavozmisionera/core/music/stemMixer'
import { currentMixerMarker, makeMixerProject, mixerProjectKey, parseMixerManifest, putMixerMarker, restoreMixerProject } from '@lavozmisionera/core/music/mixerProject'

function harness() {
  vi.useFakeTimers()
  const epoch = Date.now()
  const calls: { buffer: MixerBuffer; at: number; offset: number; duration: number; rate: number; volume: number; gain: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const audio = {
    clock: () => (Date.now() - epoch) / 1000,
    decode: async (bytes: ArrayBuffer) => ({ duration: bytes.byteLength, length: bytes.byteLength * 48000, numberOfChannels: 2 }),
    resume: async () => {},
    click: vi.fn((_at: number, _emphasis: string) => vi.fn()),
    prepare: vi.fn(async (buffers: MixerBuffer[], stretch: number, _cancelled: () => boolean) =>
      buffers.map(buffer => ({ ...buffer, length: Math.round(buffer.length * stretch), duration: buffer.duration * stretch }))),
    play(buffer: MixerBuffer, at: number, offset: number, duration: number, rate: number, volume: number) {
      const voice = { gain: vi.fn(), stop: vi.fn() }
      calls.push({ buffer, at, offset, duration, rate, volume, ...voice })
      return voice
    },
    close: vi.fn(),
  }
  const onChange = vi.fn<(state: MixerSnapshot) => void>()
  const onError = vi.fn()
  const mixer = createStemMixer(audio, onChange, onError)
  return { mixer, calls, audio, onError, snapshot: () => onChange.mock.lastCall![0] }
}

afterEach(() => vi.useRealTimers())

describe('synchronized stem mixer', () => {
  it('starts stems on the same clock and applies live mute, solo and volume without restarting them', async () => {
    const { mixer, calls, audio, snapshot } = harness()
    await mixer.add('voice', new ArrayBuffer(2))
    await mixer.add('drums', new ArrayBuffer(3))
    await mixer.play()
    expect(calls).toHaveLength(2)
    expect(calls.map(call => [call.at, call.offset, call.duration, call.volume])).toEqual([[0.055, 0, 2, 0.5], [0.055, 0, 3, 0.5]])
    const [voice, drums] = snapshot().tracks
    mixer.update(voice.id, { solo: true, volume: 0.4 })
    expect(calls[0].gain).toHaveBeenLastCalledWith(0.2)
    expect(calls[1].gain).toHaveBeenLastCalledWith(0)
    mixer.update(voice.id, { muted: true })
    expect(calls[0].gain).toHaveBeenLastCalledWith(0)
    expect(calls).toHaveLength(2)
    expect(snapshot().tracks[1]).toMatchObject({ id: drums.id, muted: false, solo: false })
    mixer.dispose()
    expect(calls.every(call => call.stop.mock.calls.length === 1)).toBe(true)
    expect(audio.close).toHaveBeenCalledOnce()
  })

  it('loops both stems on shared boundaries and truncates a shorter stem before the next cycle', async () => {
    const { mixer, calls, audio, snapshot, onError } = harness()
    await mixer.add('voice', new ArrayBuffer(2))
    await mixer.add('drums', new ArrayBuffer(3))
    expect(mixer.setLoop(1, 2.5)).toBe(true)
    mixer.setRate(1.5)
    await mixer.play()
    vi.advanceTimersByTime(1000)
    expect(calls).toHaveLength(4)
    expect(calls[0]).toMatchObject({ at: 0.055, offset: 2 / 3, duration: 2 / 3, rate: 1 })
    expect(calls[1]).toMatchObject({ at: 0.055, offset: 2 / 3, duration: 1, rate: 1 })
    expect(calls[2].at).toBeCloseTo(1.055)
    expect(calls[3].at).toBeCloseTo(1.055)
    mixer.pause()
    expect(snapshot().playing).toBe(false)
    expect(snapshot().time).toBeCloseTo(2.4175)
    vi.advanceTimersByTime(1000)
    expect(calls).toHaveLength(4)
    expect(onError).not.toHaveBeenCalled()
    expect(audio.prepare).toHaveBeenCalledOnce()
    mixer.dispose()
  })

  it('round-trips ordered files and playback settings and rejects an incomplete save before decoding', async () => {
    const source = harness()
    const voice = { size: 2, arrayBuffer: async () => new ArrayBuffer(2) }
    const drums = { size: 3, arrayBuffer: async () => new ArrayBuffer(3) }
    const voiceId = (await source.mixer.add('voice', await voice.arrayBuffer()))!
    const drumsId = (await source.mixer.add('drums', await drums.arrayBuffer()))!
    source.mixer.update(voiceId, { volume: 0.37, solo: true })
    source.mixer.update(drumsId, { muted: true })
    source.mixer.setLoop(0.5, 2)
    source.mixer.setRate(0.75)
    source.mixer.setPitch(5)
    source.mixer.setMetronome({ enabled: true, bpm: 128, meter: '3/4', offset: 0.25 })
    source.mixer.seek(1)
    const markers = putMixerMarker(putMixerMarker([], 'Coro', 1.5), 'Intro', 0)
    const project = makeMixerProject(source.snapshot(), new Map([[voiceId, voice], [drumsId, drums]]), markers)
    expect(parseMixerManifest({ ...project.manifest, pitch: undefined }).pitch).toBe(0)
    expect(parseMixerManifest({ ...project.manifest, markers: undefined }).markers).toEqual([])
    expect(parseMixerManifest({ ...project.manifest, metronome: undefined }).metronome?.enabled).toBe(false)
    expect(mixerProjectKey('draft')).not.toBe(mixerProjectKey())
    expect(mixerProjectKey('A/B')).not.toBe(mixerProjectKey('A%2FB'))
    const target = harness()
    await expect(restoreMixerProject(project.manifest, [drums, voice], target.mixer)).rejects.toThrow('files missing')
    const restored = await restoreMixerProject(JSON.parse(JSON.stringify(project.manifest)), project.files, target.mixer)
    expect(target.snapshot()).toEqual(source.snapshot())
    expect(restored.assets.get(voiceId)).toBe(voice)
    expect(restored.assets.get(drumsId)).toBe(drums)
    expect(restored.manifest.markers).toEqual([{ label: 'Intro', time: 0 }, { label: 'Coro', time: 1.5 }])
    source.mixer.dispose()
    target.mixer.dispose()
  })

  it('keeps source seconds and loop timing when pitch and speed both change', async () => {
    const { mixer, calls, audio, snapshot } = harness()
    await mixer.add('voice', new ArrayBuffer(3))
    await mixer.add('drums', new ArrayBuffer(4))
    mixer.setRate(0.5)
    mixer.setPitch(12)
    mixer.setLoop(1, 2)
    await mixer.play()
    expect(snapshot()).toMatchObject({ time: 1, rate: 0.5, pitch: 12 })
    expect(audio.prepare.mock.calls[0][1]).toBe(4)
    expect(calls.map(call => [call.at, call.offset, call.duration, call.rate]))
      .toEqual([[0.055, 4, 4, 2], [0.055, 4, 4, 2]])
    vi.advanceTimersByTime(2000)
    expect(calls[2].at).toBeCloseTo(2.055)
    expect(calls[3].at).toBeCloseTo(2.055)
    mixer.dispose()
  })

  it('schedules the metronome against the original audio grid through speed, pitch and loop boundaries', async () => {
    const { mixer, calls, audio } = harness()
    await mixer.add('voice', new ArrayBuffer(4))
    mixer.setMetronome({ enabled: true, bpm: 120, meter: '2/4', offset: 0.5 })
    mixer.setLoop(0.5, 1.5)
    mixer.setRate(0.5)
    mixer.setPitch(5)
    await mixer.play()
    expect(audio.click).toHaveBeenNthCalledWith(1, calls[0].at, 'primary')
    vi.advanceTimersByTime(2000)
    expect(audio.click.mock.calls.map(([time, accent]) => [Number(time.toFixed(3)), accent]))
      .toEqual([[0.055, 'primary'], [1.055, 'normal'], [2.055, 'primary']])
    mixer.pause()
    expect(audio.click.mock.results.at(-1)?.value).toHaveBeenCalledOnce()
    mixer.dispose()
  })

  it('seeks to the next grid beat and stops queued clicks when disabled', async () => {
    const { mixer, audio } = harness()
    await mixer.add('voice', new ArrayBuffer(4))
    mixer.setMetronome({ enabled: true, bpm: 120, meter: '4/4', offset: 0.5 })
    mixer.seek(0.8)
    await mixer.play()
    expect(audio.click).not.toHaveBeenCalled()
    vi.advanceTimersByTime(180)
    expect(audio.click.mock.calls[0][0]).toBeCloseTo(0.255)
    expect(audio.click.mock.calls[0][1]).toBe('normal')
    mixer.setMetronome({ enabled: false, bpm: 120, meter: '4/4', offset: 0.5 })
    expect(audio.click.mock.results[0].value).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1000)
    expect(audio.click).toHaveBeenCalledOnce()
    mixer.dispose()
  })

  it('restores linked chart sections and follows source time across seeks and unlinked markers', async () => {
    const { mixer, snapshot } = harness()
    const voice = { size: 4, arrayBuffer: async () => new ArrayBuffer(4) }
    const id = (await mixer.add('voice', await voice.arrayBuffer()))!
    let markers = putMixerMarker([], 'Coro', 2.25, 1)
    markers = putMixerMarker(markers, 'Verso', 0.5, 0)
    markers = putMixerMarker(markers, 'Anotación', 3)
    const chart = '{sov: Verso}\n[C]Uno\n{eov}\n{soc: Coro}\n[G]Dos\n{eoc}'
    const project = makeMixerProject(snapshot(), new Map([[id, voice]]), markers, chart, { steps: 2, preferFlat: false })
    const saved = parseMixerManifest(JSON.parse(JSON.stringify(project.manifest)))
    expect(saved).toMatchObject({ chart, chartKey: { steps: 2, preferFlat: false } })
    expect(currentMixerMarker(saved.markers, 0)).toBeUndefined()
    expect(currentMixerMarker(saved.markers, 2.24)?.section).toBe(0)
    expect(currentMixerMarker(saved.markers, 2.25)?.section).toBe(1)
    expect(currentMixerMarker(saved.markers, 3.5)?.section).toBe(1)
    expect(currentMixerMarker(saved.markers, 0.7)?.section).toBe(0)
    mixer.dispose()
  })

  it('cancels pending processing without starting a voice when stopped', async () => {
    const { mixer, calls, audio, snapshot } = harness()
    let finish!: () => void
    audio.prepare.mockImplementationOnce((buffers, _, cancelled) => new Promise(resolve => {
      finish = () => resolve(cancelled() ? null : buffers)
    }))
    await mixer.add('voice', new ArrayBuffer(3))
    mixer.setPitch(6)
    const pending = mixer.play()
    await Promise.resolve()
    expect(snapshot().preparing).toBe(true)
    mixer.stop()
    finish()
    await pending
    expect(snapshot()).toMatchObject({ preparing: false, playing: false, time: 0 })
    expect(calls).toEqual([])
    mixer.dispose()
  })
})
