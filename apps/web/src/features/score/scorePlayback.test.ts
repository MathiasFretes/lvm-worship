import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildScorePlayback, scoreEventAt } from '@lavozmisionera/core/music/scorePlayback'
import { EMPTY_SCORE, type Score } from '@lavozmisionera/core/music/score'
import { createTabSession, tabLoopMeasures } from '@lavozmisionera/core/music/tablaturePlayback'

const score: Score = {
  ...EMPTY_SCORE, tempo: 120, meter: '6/8',
  measures: [
    [{ pitch: null, type: 'eighth', dotted: false }, { pitch: { step: 'C', alter: 1, octave: 4 }, type: 'quarter', dotted: true }],
    [{ pitch: { step: 'G', alter: 0, octave: 4 }, type: 'half', dotted: true }],
  ],
}

afterEach(() => vi.useRealTimers())

describe('written score playback', () => {
  it('uses duration and silence rather than counting visual notes', () => {
    const bars = buildScorePlayback(score)
    expect(bars[0]).toEqual({
      system: 0, measure: 0, columns: 24, quarterBeats: 3, clicks: 2,
      notes: [{ column: 4, midi: 61, length: 12 }],
    })
    expect([0, 4, 15, 16].map(tick => scoreEventAt(score.measures[0], tick))).toEqual([0, 1, 1, -1])
  })

  it('plays the dotted note for its written length, resumes it midway, and follows the selected measure range', async () => {
    vi.useFakeTimers()
    const base = Date.now()
    const note = vi.fn((_at: number, _midi: number, _duration: number, _click: boolean, _sustain?: boolean) => vi.fn())
    const onPosition = vi.fn()
    const session = createTabSession({
      open: async () => ({ clock: () => (Date.now() - base) / 1000, note, close: vi.fn() }),
      onPosition, onStatus: vi.fn(),
    })
    const bars = tabLoopMeasures(buildScorePlayback(score), '1', '1')
    await session.play(bars, score.tempo, 100, 2, true, true)
    vi.advanceTimersByTime(600)
    const first = note.mock.calls.find(([, , , click]) => !click)!
    expect(first[0]).toBeCloseTo(0.31)
    expect(first.slice(1)).toEqual([63, 0.75, false, true])
    session.pause()
    await session.play(bars, score.tempo, 100, 2, true, true)
    vi.advanceTimersByTime(80)
    const resumed = note.mock.calls.filter(([, , , click]) => !click).at(-1)!
    expect(resumed[0]).toBeCloseTo(0.66)
    expect(resumed[2]).toBeCloseTo(0.46)
    vi.advanceTimersByTime(1500)
    const clickTimes = note.mock.calls.filter(([, , , click]) => click).map(([at]) => at)
    expect(clickTimes).toHaveLength(3)
    expect(clickTimes[2] - clickTimes[1]).toBeCloseTo(0.75)
    expect(onPosition.mock.calls.every(([position]) => position.measure === 0)).toBe(true)
    session.dispose()
  })
})
