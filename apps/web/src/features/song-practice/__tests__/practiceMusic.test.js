import { describe, expect, it } from 'vitest'
import { chordVoicings, collectSongChords, describeChord, fingeringForFrets, keyboardVoicing, midiFrequency, notePitch } from '../practiceMusic'

describe('practice instrument harmony', () => {
  it('preserves extensions and slash bass without inventing an unknown chord', () => {
    expect(describeChord('Bbmaj7/D')).toMatchObject({ root: 10, bass: 2, pitches: [10, 2, 5, 9] })
    expect(describeChord('Cunknown')).toBeNull()
    expect(chordVoicings('Cunknown')).toEqual([])
    expect(notePitch('B#')).toBe(0)
  })

  it.each(['C', 'Am', 'F', 'G7', 'C/E', 'F#m7', 'Bdim', 'E5'])('generates positions with the correct bass and chord notes for %s', symbol => {
    const chord = describeChord(symbol)
    const positions = chordVoicings(symbol)
    expect(positions.length).toBeGreaterThan(0)
    for (const position of positions) {
      expect(Math.min(...position.notes) % 12).toBe(chord.bass)
      expect(position.notes.every(note => chord.pitches.includes(note % 12))).toBe(true)
      expect(chord.pitches.every(pitch => position.notes.some(note => note % 12 === pitch))).toBe(true)
      expect(Number.isFinite(position.position)).toBe(true)
      expect(position.count).toBeLessThanOrEqual(4)
    }
  })

  it('does not barre across strings that must ring open or at lower frets', () => {
    expect(fingeringForFrets([1, 3, 3, 2, 1, 1]).count).toBe(3)
    expect(fingeringForFrets([1, 0, 1, 0, 1, 0]).count).toBe(3)
    expect(fingeringForFrets([3, 1, 3, 1, 3, 1]).count).toBe(4)
  })

  it('supports reentrant ukulele and keyboard inversions', () => {
    expect(chordVoicings('C', 'ukulele').length).toBeGreaterThan(0)
    const notes = keyboardVoicing('C/E')
    expect(Math.min(...notes) % 12).toBe(4)
    expect(new Set(notes.map(note => note % 12))).toEqual(new Set([0, 4, 7]))
    expect(midiFrequency(69)).toBe(440)
  })

  it('collects actual parser chord symbols in first-occurrence order', () => {
    const blocks = [{ lines: [{ chords: [{ sym: 'C' }, { sym: 'G7' }, { sym: 'C' }] }] }]
    expect(collectSongChords(blocks, symbol => symbol)).toEqual(['C', 'G7'])
  })
})
