import { beatEmphasis, beatIntervalSec, beatsInMeasure } from '@lavozmisionera/core/music/metronomePattern'
import { createYinDetector, rmsLevel } from '@lavozmisionera/core/music/tunerYin'

const CLICK_FREQUENCY = { primary: 1760, secondary: 1320, normal: 1000 }

export function openMetronome(audio, settings, publish) {
  let next = audio.currentTime + 0.04
  let beat = 0
  let current = null
  let signature
  const queue = []
  function tick() {
    const { bpm, meter, accent } = settings()
    const now = audio.currentTime
    if (meter !== signature) {
      signature = meter
      beat = 0
    }
    if (next < now) {
      beat = 0
      next = now + 0.025
    }
    while (queue.length && queue[0].time <= now) current = queue.shift().beat
    publish(current)
    while (next < now + 0.1) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      const emphasis = beatEmphasis(meter, beat, accent)
      osc.frequency.value = CLICK_FREQUENCY[emphasis]
      gain.gain.setValueAtTime(0.0001, next)
      gain.gain.exponentialRampToValueAtTime(emphasis === 'primary' ? 0.24 : 0.14, next + 0.003)
      gain.gain.exponentialRampToValueAtTime(0.0001, next + 0.044)
      osc.connect(gain).connect(audio.destination)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
      osc.start(next)
      osc.stop(next + 0.05)
      queue.push({ time: next, beat })
      next += beatIntervalSec(bpm)
      beat = (beat + 1) % beatsInMeasure(meter)
    }
  }
  tick()
  const timer = setInterval(tick, 25)
  return () => clearInterval(timer)
}

export function openTuner(audio, stream, publish) {
  const input = audio.createMediaStreamSource(stream)
  const analyser = audio.createAnalyser()
  // Analyze around 85 ms at 24 kHz or more, limiting the cost on phones.
  const stride = Math.max(1, Math.floor(audio.sampleRate / 24000))
  analyser.fftSize = 2 ** Math.ceil(Math.log2(2048 * stride))
  const raw = new Float32Array(analyser.fftSize)
  const frame = new Float32Array(2048)
  const detector = createYinDetector({ sampleRate: audio.sampleRate / stride, windowSize: frame.length })
  input.connect(analyser)
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(raw)
    const offset = raw.length - frame.length * stride
    for (let i = 0; i < frame.length; i += 1) {
      let sum = 0
      for (let j = 0; j < stride; j += 1) sum += raw[offset + i * stride + j]
      frame[i] = sum / stride
    }
    const reading = rmsLevel(frame) >= 0.006 ? detector.detect(frame) : null
    publish(reading?.frequency ?? null)
  }, 100)
  return () => { clearInterval(timer); input.disconnect() }
}
