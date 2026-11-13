import { describe, expect, it } from 'vitest'
import { createMetronomeClock, type MetronomePulse, type MetronomeSettings, type MetronomeVoice } from '@lavozmisionera/core/music/metronomeClock'

const settings: MetronomeSettings = { bpm: 120, meter: '2/4', accent: true, division: 3, countIn: 2 }

function record() {
  const clicks: { time: number; voice: MetronomeVoice }[] = []
  const pulses: MetronomePulse[] = []
  const advance = createMetronomeClock(0.1, settings.countIn,
    (time, voice) => clicks.push({ time, voice }), pulse => pulses.push(pulse))
  return { clicks, pulses, advance }
}

describe('shared metronome clock', () => {
  it('counts two measures of main pulses and then plays subdivided triplets', () => {
    const { advance, clicks, pulses } = record()
    for (let tick = 0; tick <= 112; tick += 1) advance(tick * 0.025, settings)
    expect(clicks.slice(0, 8).map(click => click.voice)).toEqual([
      'countIn', 'countIn', 'countIn', 'countIn', 'primary', 'subdivision', 'subdivision', 'normal',
    ])
    expect(clicks.slice(0, 5).map(click => Number(click.time.toFixed(3)))).toEqual([0.1, 0.6, 1.1, 1.6, 2.1])
    expect(clicks[5].time - clicks[4].time).toBeCloseTo(1 / 6)
    expect(pulses.map(({ beat, remaining }) => [beat, remaining])).toEqual([[0, 2], [1, 2], [0, 1], [1, 1], [0, 0], [1, 0]])
  })

  it('does not schedule a burst of stale clicks after a stalled timer', () => {
    const { advance, clicks } = record()
    advance(0, settings)
    for (let tick = 0; tick <= 12; tick += 1) advance(60 + tick * 0.025, settings)
    expect(clicks).toHaveLength(2)
    expect(clicks[1].time).toBeGreaterThan(60)
  })
})
