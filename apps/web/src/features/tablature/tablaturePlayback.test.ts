import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTabPlayback, createTabSession, createTabTransport, tabLoopMeasures } from '@lavozmisionera/core/music/tablaturePlayback'

const source = ['e|12------|2---|', 'B|--------|----|', 'G|--------|----|', 'D|--------|----|', 'A|--------|----|', 'E|0-------|----|'].join('\n')
const measures = buildTabPlayback(source)
afterEach(() => vi.useRealTimers())

describe('tablature playback', () => {
  it('reads fret pitches, recognizes two-digit notes, and keeps simultaneous strings together', () => {
    expect(measures[0]).toEqual({ system: 0, measure: 0, columns: 8, notes: [{ column: 0, midi: 76 }, { column: 0, midi: 40 }] })
    expect(tabLoopMeasures(measures, '2', '')).toEqual([measures[1]])
    expect(tabLoopMeasures(measures, '2', '1')).toEqual([])
    const bass = ['G|0---|', 'D|0---|', 'A|0---|', 'E|0---|'].join('\n')
    expect(buildTabPlayback(bass)[0].notes.map(note => note.midi)).toEqual([43, 38, 33, 28])
  })

  it('schedules notes and metronome against one clock and loops only the selected measure', () => {
    vi.useFakeTimers()
    const base = Date.now()
    const cancel = vi.fn()
    const note = vi.fn((_at: number, _midi: number, _decay: number, _click: boolean) => () => cancel())
    const onPosition = vi.fn()
    const transport = createTabTransport({
      measures: tabLoopMeasures(measures, '2', '2'), secondsPerMeasure: 1, transpose: 2, loop: true, metronome: true,
      clock: () => (Date.now() - base) / 1000, note, onPosition, onEnd: vi.fn(), onError: vi.fn(),
    })
    transport.play()
    expect(note.mock.calls).toContainEqual([0.06, 68, 0.35, false])
    vi.advanceTimersByTime(1100)
    expect(note.mock.calls.filter(([, , , click]) => click).map(([at]) => at)).toEqual([0.06, 0.31, 0.56, 0.81, 1.06])
    expect(onPosition.mock.calls.every(([position]) => position.measure === 1)).toBe(true)
    transport.pause()
    const count = note.mock.calls.length
    vi.advanceTimersByTime(1000)
    expect(note).toHaveBeenCalledTimes(count)
    expect(cancel).toHaveBeenCalled()
    transport.play()
    vi.advanceTimersByTime(250)
    expect(note.mock.calls.length).toBeGreaterThan(count)
    transport.stop()
  })

  it('closes an audio driver that finishes opening after the screen closes', async () => {
    const close = vi.fn()
    const onStatus = vi.fn()
    let ready!: (driver: { close: () => void; clock: () => number; note: () => () => void }) => void
    const session = createTabSession({ open: () => new Promise(resolve => { ready = resolve }), onPosition: vi.fn(), onStatus })
    const opening = session.play(measures, 96, 100, 0, false)
    session.dispose()
    ready({ close, clock: () => 0, note: () => vi.fn() })
    await opening
    expect(close).toHaveBeenCalledOnce()
    expect(onStatus.mock.calls).toEqual([['opening']])
  })
})
