import { describe, expect, it } from 'vitest'
import { encodeSeparatedWavs, reconstructSeparation, separateSources, separationSpectrum, SEPARATION_CHUNK } from '../../../../../packages/core/src/music/sourceSeparation'

describe('local source separation DSP', () => {
  it('reconstructs a stereo spectrum with a complex identity mask', async () => {
    const input = [1, 2].map(channel => Float32Array.from({ length: SEPARATION_CHUNK }, (_, n) => Math.sin(n * Math.PI * channel / 16) * 0.3))
    const spectrum = await separationSpectrum(input)
    const mask = new Float32Array(spectrum.length)
    const plane = 1025 * 801
    mask.fill(1, 0, plane); mask.fill(1, plane * 2, plane * 3)
    const restored = await reconstructSeparation(spectrum, mask)
    for (let channel = 0; channel < 2; channel++) {
      let squared = 0
      // Removing DC affects reflected edge windows; compare the centered signal.
      for (let n = 2048; n < SEPARATION_CHUNK - 2048; n++) squared += (input[channel][n] - restored[channel][n]) ** 2
      expect(Math.sqrt(squared / (SEPARATION_CHUNK - 4096))).toBeLessThan(1e-6)
    }
  })

  it('keeps short mono audio aligned and applies shared gain to the two PCM stems', async () => {
    const input = Float32Array.from({ length: 2111 }, (_, n) => Math.sin(n / 17) * 0.4)
    const output = await separateSources([input], async spec => new Float32Array(spec.length))
    expect(output.vocals[0]).toEqual(new Float32Array(input.length))
    expect(output.backing[0]).toEqual(input)
    const [voice, backing] = encodeSeparatedWavs([Float32Array.of(2, -2)], [Float32Array.of(1, -1)])
    const a = new DataView(voice.buffer), b = new DataView(backing.buffer)
    expect(a.getUint32(24, true)).toBe(44100)
    expect(a.getInt16(44, true)).toBe(32767)
    expect(b.getInt16(44, true)).toBe(16384)
    expect(a.getUint32(40, true)).toBe(4)
    expect(voice.length).toBe(backing.length)
  })

  it('cancels before inference and rejects malformed model output', async () => {
    let called = false
    await expect(separateSources([new Float32Array(100)], async () => { called = true; return new Float32Array() }, async () => { throw new Error('cancelled') })).rejects.toThrow('cancelled')
    expect(called).toBe(false)
    await expect(reconstructSeparation(new Float32Array(1), new Float32Array(1))).rejects.toThrow('Invalid separator output')
    await expect(separateSources([Float32Array.of(NaN)], async () => new Float32Array())).rejects.toThrow('Invalid separation audio')
  })

  it('crossfades successive windows without losing samples or changing mono alignment', async () => {
    const input = Float32Array.from({ length: SEPARATION_CHUNK + 44100 }, (_, n) => Math.sin(n * Math.PI / 16) * 0.3)
    const progress: number[] = []
    const output = await separateSources([input], async spec => {
      const mask = new Float32Array(spec.length)
      mask.fill(1, 0, 1025 * 801); mask.fill(1, 2 * 1025 * 801, 3 * 1025 * 801)
      return mask
    }, undefined, fraction => progress.push(fraction))
    expect(progress).toEqual([SEPARATION_CHUNK / input.length, 1])
    expect(output.vocals[0].length).toBe(input.length)
    for (let n = 2048; n < input.length - 2048; n += 127) {
      expect(Math.abs(input[n] - output.vocals[0][n])).toBeLessThan(0.0001)
      expect(Math.abs(input[n] - output.vocals[0][n] - output.backing[0][n])).toBeLessThan(1e-7)
    }
  })
})
