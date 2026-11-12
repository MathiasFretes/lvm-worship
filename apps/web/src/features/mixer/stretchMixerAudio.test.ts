import { describe, expect, it } from 'vitest'
import { stretchMixerAudio } from '@lavozmisionera/core/music/stretchMixerAudio'

function pcm(numberOfChannels: number, length: number, sampleRate: number) {
  const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  return { numberOfChannels, length, sampleRate, getChannelData: (channel: number) => channels[channel] }
}

function strongestFrequency(samples: Float32Array, sampleRate: number) {
  let peak = 0
  let strongest = 0
  for (let frequency = 400; frequency <= 480; frequency++) {
    let real = 0
    let imaginary = 0
    for (let i = 0; i < samples.length; i++) {
      const angle = 2 * Math.PI * frequency * i / sampleRate
      real += samples[i] * Math.cos(angle)
      imaginary += samples[i] * Math.sin(angle)
    }
    const energy = real * real + imaginary * imaginary
    if (energy > peak) {
      peak = energy
      strongest = frequency
    }
  }
  return strongest
}

describe('shared mixer waveform alignment', () => {
  it('changes frame count while retaining the tone and relative phase across stems', async () => {
    const voice = pcm(1, 16000, 8000)
    const duplicate = pcm(1, 16000, 8000)
    const left = voice.getChannelData(0)
    const right = duplicate.getChannelData(0)
    for (let i = 0; i < left.length; i++) {
      left[i] = Math.sin(2 * Math.PI * 440 * i / 8000)
      right[i] = left[i] * 0.5
    }
    for (const factor of [0.75, 2]) {
      const [longer, aligned] = (await stretchMixerAudio([voice, duplicate], factor, pcm, () => false))!
      expect(longer.length).toBe(16000 * factor)
      const samples = longer.getChannelData(0)
      expect(Math.abs(strongestFrequency(samples.subarray(2400, 10400), 8000) - 440)).toBeLessThanOrEqual(3)
      expect(samples.every((sample, i) => aligned.getChannelData(0)[i] === sample * 0.5)).toBe(true)
    }
  })
})
