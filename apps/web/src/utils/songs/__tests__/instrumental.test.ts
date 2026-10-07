import { describe, it, expect } from 'vitest'
import { transposeInstrumental, formatInstrumental, splitInstrumental } from '../instrumental.js'

describe('LVM instrumental-section behavior', () => {
  it('transposes a band cue while preserving its repeat count', () => {
    const inst = transposeInstrumental({ chords: ['D', 'A/C#'], repeat: 3 }, 2)
    expect(inst.chords).toEqual(['E', 'B/D#'])
    expect(inst.repeat).toBe(3)
  })

  it.each([
    ['one rehearsal row', { chords: ['D', 'A', 'E'] }, false, ['D  //  A  //  E']],
    [
      'two balanced projection rows',
      { chords: ['Em', 'D', 'Am7', 'Bm7'], repeat: 2 },
      true,
      ['Em  //  D', 'Am7  //  Bm7 x2'],
    ],
  ])('formats %s', (_scenario, instrumental, split, expected) => {
    expect(formatInstrumental(instrumental, { split })).toEqual(expected)
  })

  it('exposes balanced chord groups to renderers', () => {
    const groups = splitInstrumental({ chords: ['C', 'G', 'Am', 'F', 'G'] }, { split: true })
    expect(groups).toEqual([
      ['C', 'G', 'Am'],
      ['F', 'G'],
    ])
  })
})
