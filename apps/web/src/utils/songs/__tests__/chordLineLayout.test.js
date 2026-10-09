import { describe, expect, test } from 'vitest'
import { buildChordRowsLayout, splitTextRowsByWidth } from '../chordLineLayout'

function monoMeasure(widthPerChar = 10){
  return (text = '') => String(text || '').length * widthPerChar
}

describe('LVM projected chord-line layout', () => {
  test.each([
    ['Bendice alma mía al Señor', 90],
    ['Id y haced discípulos a todas las naciones', 120],
  ])('wraps %j within a %dpx projection column', (lyrics, width) => {
    const rows = splitTextRowsByWidth(lyrics, width, monoMeasure(10))
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.map(row => row.text).join(' ')).toBe(lyrics)
  })

  test('keeps every transposed chord visible after lyrics wrap', () => {
    const plain = 'Bendice alma mía al Señor y adora siempre su santo nombre'
    const chords = [
      { sym: 'C', index: 0 },
      { sym: 'G', index: 10 },
      { sym: 'D/F#', index: 22 },
      { sym: 'Em', index: 35 },
      { sym: 'Gsus', index: 46 },
    ]
    const rowWidth = 120
    const measureLyric = monoMeasure(8)
    const measureChord = monoMeasure(9)

    const rows = buildChordRowsLayout({
      plain,
      chords,
      width: rowWidth,
      measureLyric,
      measureChord,
      transposeSym: (sym) => sym,
      spaceWidth: measureLyric(' '),
    })

    expect(rows.length).toBeGreaterThan(1)
    const renderedChords = rows.flatMap(row => row.offsets)
    expect(renderedChords.map(chord => chord.sym)).toEqual(chords.map(chord => chord.sym))
    expect(renderedChords.every(chord =>
      chord.left >= 0 && chord.left + measureChord(chord.sym) <= rowWidth
    )).toBe(true)
  })
})
