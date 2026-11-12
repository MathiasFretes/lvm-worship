export type MixerPcm = {
  length: number
  sampleRate: number
  numberOfChannels: number
  getChannelData: (channel: number) => Float32Array
}

const OUTPUT_BUDGET = 128 * 1024 * 1024
const TOTAL_BUDGET = 256 * 1024 * 1024
const ANALYSIS_STEP = 4

// Use one waveform-similarity alignment for every channel and stem. Independent
// window offsets would move matching transients apart even on the same clock.
export async function stretchMixerAudio<Buffer extends MixerPcm>(
  sources: Buffer[],
  stretch: number,
  allocate: (channels: number, frames: number, sampleRate: number) => Buffer,
  cancelled: () => boolean,
): Promise<Buffer[] | null> {
  const sampleRate = sources[0]?.sampleRate
  if (!sampleRate || sources.some(source => source.sampleRate !== sampleRate)) {
    throw new Error('Mixer audio must share one sample rate')
  }
  const sizes = sources.map(source => Math.max(1, Math.round(source.length * stretch)))
  const inputBytes = sources.reduce((sum, source) => sum + source.numberOfChannels * source.length * 4, 0)
  const outputBytes = sources.reduce((sum, source, index) => sum + source.numberOfChannels * sizes[index] * 4, 0)
  const maxInput = Math.max(...sources.map(source => source.length))
  const maxOutput = Math.max(...sizes)
  const analysisLength = Math.ceil(maxInput / ANALYSIS_STEP)
  if (outputBytes > OUTPUT_BUDGET || inputBytes + outputBytes + analysisLength * 4 > TOTAL_BUDGET) {
    throw new Error('Mixer pitch and speed processing exceeds the memory budget')
  }
  if (cancelled()) return null

  const outputs = sources.map((source, index) => allocate(source.numberOfChannels, sizes[index], sampleRate))
  const channels = sources.flatMap((source, index) => Array.from({ length: source.numberOfChannels }, (_, channel) => ({
    input: source.getChannelData(channel),
    output: outputs[index].getChannelData(channel),
  })))
  const analysis = new Float32Array(analysisLength)
  let yieldedAt = Date.now()
  const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0))
  for (const { input } of channels) {
    const count = Math.ceil(input.length / ANALYSIS_STEP)
    for (let index = 0; index < count; index++) {
      analysis[index] += input[index * ANALYSIS_STEP] / channels.length
      if (index % 8192 === 0 && Date.now() - yieldedAt >= 12) {
        await yieldToUi()
        if (cancelled()) return null
        yieldedAt = Date.now()
      }
    }
  }

  const overlap = Math.max(4, Math.round(sampleRate * 0.012 / ANALYSIS_STEP) * ANALYSIS_STEP)
  const hop = overlap * 2
  const window = hop + overlap
  const radius = overlap / ANALYSIS_STEP
  const maxStart = Math.max(0, maxInput - window)
  let previous = 0

  for (let destination = 0; destination < maxOutput; destination += hop) {
    const nominal = Math.min(maxStart, Math.round(destination / stretch))
    const source = destination === 0 || nominal === maxStart
      ? nominal
      : alignWindow(analysis, nominal, previous + hop, radius, maxStart)
    for (const { input, output } of channels) {
      const count = Math.min(window, output.length - destination)
      for (let index = 0; index < count; index++) {
        const sample = input[source + index] ?? 0
        if (destination !== 0 && index < overlap) {
          const weight = (index + 1) / (overlap + 1)
          output[destination + index] = output[destination + index] * (1 - weight) + sample * weight
        } else {
          output[destination + index] = sample
        }
      }
    }
    previous = source
    if (Date.now() - yieldedAt >= 12) {
      await yieldToUi()
      if (cancelled()) return null
      yieldedAt = Date.now()
    }
  }
  return outputs
}

function alignWindow(analysis: Float32Array, nominal: number, previous: number, radius: number, maxStart: number) {
  const center = Math.round(nominal / ANALYSIS_STEP)
  const reference = Math.round(previous / ANALYSIS_STEP)
  const lo = Math.max(0, center - radius)
  const hi = Math.min(Math.floor(maxStart / ANALYSIS_STEP), center + radius)
  let referencePower = 0
  for (let i = 0; i < radius; i += 2) referencePower += (analysis[reference + i] ?? 0) ** 2
  if (referencePower < 1e-8) return nominal
  let best = center
  let score = -Infinity
  function compare(start: number) {
    let power = 0
    let product = 0
    for (let i = 0; i < radius; i += 2) {
      const sample = analysis[start + i] ?? 0
      power += sample * sample
      product += sample * (analysis[reference + i] ?? 0)
    }
    if (power < 1e-8) return
    const similarity = product / Math.sqrt(power * referencePower) - Math.abs(start - center) / radius * 0.03
    if (similarity > score) {
      best = start
      score = similarity
    }
  }
  for (let start = lo; start <= hi; start += 4) compare(start)
  const coarse = best
  for (let start = Math.max(lo, coarse - 3); start <= Math.min(hi, coarse + 3); start++) compare(start)
  return score === -Infinity ? nominal : best * ANALYSIS_STEP
}
