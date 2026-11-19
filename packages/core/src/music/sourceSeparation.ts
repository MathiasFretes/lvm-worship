import FFT from 'fft.js'

export const SEPARATION_RATE = 44100
export const SEPARATION_CHUNK = 352800
export const SEPARATION_SHAPE = [1, 4, 1025, 801] as const
const SIZE = 2048
const HOP = 441
const BINS = 1025
const FRAMES = 801
const PLANE = BINS * FRAMES
const FADE = 35280
const window = Float32Array.from({ length: SIZE }, (_, n) => 0.5 - 0.5 * Math.cos(2 * Math.PI * n / SIZE))
type Checkpoint = () => Promise<void>
const idle: Checkpoint = async () => {}

/** Centered, reflect-padded STFT in the pinned MelBandRoformer export layout. */
export async function separationSpectrum(stereo: readonly Float32Array[], checkpoint: Checkpoint = idle) {
  if (stereo.length !== 2 || stereo.some(channel => channel.length !== SEPARATION_CHUNK)) throw new Error('Invalid separation chunk')
  const fft = new FFT(SIZE)
  const input = new Float64Array(SIZE)
  const output = new Float64Array(SIZE * 2)
  const planes = new Float32Array(4 * PLANE)
  for (let channel = 0; channel < 2; channel++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      if (frame % 32 === 0) await checkpoint()
      for (let n = 0; n < SIZE; n++) {
        let index = frame * HOP + n - SIZE / 2
        if (index < 0) index = -index
        else if (index >= SEPARATION_CHUNK) index = 2 * SEPARATION_CHUNK - index - 2
        input[n] = stereo[channel][index] * window[n]
      }
      fft.realTransform(output, input)
      for (let bin = 0; bin < BINS; bin++) {
        const index = channel * 2 * PLANE + bin * FRAMES + frame
        planes[index] = output[bin * 2]
        planes[index + PLANE] = output[bin * 2 + 1]
      }
    }
  }
  return planes
}

export async function reconstructSeparation(spec: Float32Array, mask: Float32Array, checkpoint: Checkpoint = idle) {
  if (spec.length !== 4 * PLANE || mask.length !== spec.length) throw new Error('Invalid separator output')
  const fft = new FFT(SIZE)
  const spectrum = new Float64Array(SIZE * 2)
  const inverse = new Float64Array(SIZE * 2)
  const channels = [new Float32Array(SEPARATION_CHUNK), new Float32Array(SEPARATION_CHUNK)]
  const weights = new Float32Array(SEPARATION_CHUNK)
  for (let channel = 0; channel < 2; channel++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      if (frame % 32 === 0) await checkpoint()
      spectrum[0] = spectrum[1] = 0
      for (let bin = 1; bin < BINS; bin++) {
        const index = channel * 2 * PLANE + bin * FRAMES + frame
        const re = mask[index], im = mask[index + PLANE]
        if (!Number.isFinite(re) || !Number.isFinite(im)) throw new Error('Invalid separator output')
        spectrum[bin * 2] = spec[index] * re - spec[index + PLANE] * im
        spectrum[bin * 2 + 1] = spec[index] * im + spec[index + PLANE] * re
      }
      fft.completeSpectrum(spectrum)
      fft.inverseTransform(inverse, spectrum)
      for (let n = 0; n < SIZE; n++) {
        const index = frame * HOP + n - SIZE / 2
        if (index < 0 || index >= SEPARATION_CHUNK) continue
        channels[channel][index] += inverse[n * 2] * window[n]
        if (!channel) weights[index] += window[n] ** 2
      }
    }
  }
  for (const channel of channels) for (let n = 0; n < channel.length; n++) channel[n] /= weights[n]
  return channels
}

export async function separateSources(mix: readonly Float32Array[], infer: (spec: Float32Array) => Promise<Float32Array>,
  checkpoint: Checkpoint = idle, progress: (fraction: number) => void = () => {}) {
  const length = mix[0]?.length ?? 0
  if (!length || length > SEPARATION_RATE * 140 || ![1, 2].includes(mix.length) ||
      mix.some(channel => channel.length !== length || channel.some(sample => !Number.isFinite(sample)))) throw new Error('Invalid separation audio')
  const vocals = mix.map(() => new Float32Array(length))
  const weights = new Float32Array(length)
  for (let start = 0; start < length; start += SEPARATION_CHUNK / 2) {
    await checkpoint()
    const count = Math.min(SEPARATION_CHUNK, length - start)
    const end = start + count
    const chunk = [0, 1].map(channel => {
      const data = new Float32Array(SEPARATION_CHUNK)
      data.set(mix[Math.min(channel, mix.length - 1)].subarray(start, end))
      return data
    })
    const spec = await separationSpectrum(chunk, checkpoint)
    const mask = await infer(spec)
    await checkpoint()
    const output = await reconstructSeparation(spec, mask, checkpoint)
    for (let n = 0; n < count; n++) {
      let gain = 1
      if (start && n < FADE) gain = n / (FADE - 1)
      if (end < length && n >= count - FADE) gain = (count - n - 1) / (FADE - 1)
      weights[start + n] += gain
      for (let channel = 0; channel < mix.length; channel++) {
        const sample = mix.length === 1 ? (output[0][n] + output[1][n]) / 2 : output[channel][n]
        vocals[channel][start + n] += sample * gain
      }
    }
    progress(end / length)
    if (end === length) break
  }
  const backing = mix.map((channel, c) => Float32Array.from(channel, (sample, n) => {
    vocals[c][n] /= weights[n]
    return sample - vocals[c][n]
  }))
  return { vocals, backing }
}

/** A shared gain preserves the balance and keeps both 16-bit WAV files unclipped. */
export function encodeSeparatedWavs(vocals: readonly Float32Array[], backing: readonly Float32Array[]) {
  let peak = 1
  for (const stem of [vocals, backing]) for (const channel of stem) for (const sample of channel) {
    if (!Number.isFinite(sample)) throw new Error('Invalid separation audio')
    peak = Math.max(peak, Math.abs(sample))
  }
  return [vocals, backing].map(stem => {
    const channels = stem.length, length = stem[0].length
    const bytes = new Uint8Array(44 + length * channels * 2)
    const view = new DataView(bytes.buffer)
    const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true)
    view.setUint32(24, SEPARATION_RATE, true); view.setUint32(28, SEPARATION_RATE * channels * 2, true)
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, bytes.length - 44, true)
    for (let n = 0; n < length; n++) for (let c = 0; c < channels; c++) view.setInt16(44 + (n * channels + c) * 2, Math.round(stem[c][n] * 32767 / peak), true)
    return bytes
  })
}
