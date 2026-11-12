import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStemMixer, type MixerBuffer, type MixerSnapshot } from '@lavozmisionera/core/music/stemMixer'

function harness() {
  vi.useFakeTimers()
  const epoch = Date.now()
  const calls: { buffer: MixerBuffer; at: number; offset: number; duration: number; rate: number; volume: number; gain: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const audio = {
    clock: () => (Date.now() - epoch) / 1000,
    decode: async (bytes: ArrayBuffer) => ({ duration: bytes.byteLength, length: bytes.byteLength * 48000, numberOfChannels: 2 }),
    resume: async () => {},
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
    const { mixer, calls, snapshot, onError } = harness()
    await mixer.add('voice', new ArrayBuffer(2))
    await mixer.add('drums', new ArrayBuffer(3))
    expect(mixer.setLoop(1, 2.5)).toBe(true)
    mixer.setRate(1.5)
    await mixer.play()
    vi.advanceTimersByTime(1000)
    expect(calls).toHaveLength(4)
    expect(calls[0]).toMatchObject({ at: 0.055, offset: 1, duration: 1, rate: 1.5 })
    expect(calls[1]).toMatchObject({ at: 0.055, offset: 1, duration: 1.5, rate: 1.5 })
    expect(calls[2].at).toBeCloseTo(1.055)
    expect(calls[3].at).toBeCloseTo(1.055)
    mixer.pause()
    expect(snapshot().playing).toBe(false)
    expect(snapshot().time).toBeCloseTo(2.4175)
    vi.advanceTimersByTime(1000)
    expect(calls).toHaveLength(4)
    expect(onError).not.toHaveBeenCalled()
    mixer.dispose()
  })
})
