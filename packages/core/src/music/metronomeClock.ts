import { beatEmphasis, beatIntervalSec, beatsInMeasure, type BeatEmphasis, type TimeSignatureId } from './metronomePattern'

export const METRONOME_DIVISIONS = [1, 2, 3, 4] as const
export const METRONOME_COUNT_IN = [0, 1, 2] as const
export type MetronomeDivision = typeof METRONOME_DIVISIONS[number]
export type MetronomeCountIn = typeof METRONOME_COUNT_IN[number]

export type MetronomeSettings = {
  bpm: number
  meter: TimeSignatureId
  accent: boolean
  division: MetronomeDivision
  countIn: MetronomeCountIn
}

export type MetronomePulse = { time: number; beat: number; remaining: number }
type Click = (time: number, voice: 'countIn' | 'subdivision' | BeatEmphasis) => void
export type MetronomeVoice = Parameters<Click>[1]

export function createMetronomeClock(start: number, countIn: MetronomeCountIn, click: Click, publish: (pulse: MetronomePulse) => void) {
  let next = start
  let beat = 0
  let sub = 0
  let remaining: number = countIn
  let previousMeter: TimeSignatureId | undefined
  let previousDivision: MetronomeDivision | undefined
  const pending: MetronomePulse[] = []

  return (now: number, { bpm, meter, accent, division }: MetronomeSettings) => {
    if (next < now) next = now + 0.025
    if (meter !== previousMeter || division !== previousDivision) {
      beat = 0
      sub = 0
      previousMeter = meter
      previousDivision = division
    }
    let sounding: MetronomePulse | undefined
    while (pending.length && pending[0].time <= now) sounding = pending.shift()
    if (sounding) publish(sounding)

    const beats = beatsInMeasure(meter)
    while (next < now + 0.12) {
      if (sub === 0) {
        pending.push({ time: next, beat, remaining })
        click(next, remaining ? 'countIn' : beatEmphasis(meter, beat, accent))
      } else if (!remaining) {
        click(next, 'subdivision')
      }
      next += beatIntervalSec(bpm) / division
      sub = (sub + 1) % division
      if (sub === 0) {
        beat = (beat + 1) % beats
        if (beat === 0 && remaining > 0) remaining -= 1
      }
    }
  }
}

export function runMetronome(clock: () => number, settings: () => MetronomeSettings, click: Click, publish: (pulse: MetronomePulse) => void) {
  const advance = createMetronomeClock(clock() + 0.04, settings().countIn, click, publish)
  const tick = () => advance(clock(), settings())
  tick()
  const timer = setInterval(tick, 25)
  return () => clearInterval(timer)
}
