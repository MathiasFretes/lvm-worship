import { describe, expect, it } from 'vitest'
import { readMusicXml, writeMusicXml } from '@lavozmisionera/core/music/musicXml'
import { DEFAULT_SCORE_NOTE, EMPTY_SCORE, editScoreNote, fillScoreMeasure, measureTicks, meterTicks, parseScoreDraft, scoreStaff, type Score } from '@lavozmisionera/core/music/score'

describe('single-voice MusicXML score', () => {
  it('round-trips written durations, tempo, rests, accidentals and Unicode text', () => {
    let score: Score = { ...EMPTY_SCORE, title: 'Ensayo 🎵 & «música»', meter: '6/8', tempo: 108, clef: 'F' }
    score = editScoreNote(score, 0, 0, { pitch: { step: 'C', octave: 4, alter: 1 }, type: 'quarter', dotted: true })!
    score = editScoreNote(score, 0, 1, DEFAULT_SCORE_NOTE)!
    expect(editScoreNote(score, 0, 2, DEFAULT_SCORE_NOTE)).toBeNull()
    score = fillScoreMeasure(score, 0)
    expect(measureTicks(score.measures[0])).toBe(meterTicks('6/8'))
    expect(scoreStaff(score.measures[0], 'F').notes.map(note => note.accidental)).toEqual(['♯', '♮', ''])
    expect(parseScoreDraft(JSON.stringify(score))).toEqual(score)
    const xml = writeMusicXml(score)
    expect(xml).toContain('<accidental>natural</accidental>')
    expect(readMusicXml(xml)).toEqual(score)
  })

  it('reads a standard external MusicXML declaration and a full 5/4 rest', () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>4</divisions><time><beats>5</beats><beat-type>4</beat-type></time></attributes>
<note><rest measure="yes"/><duration>20</duration></note></measure></part></score-partwise>`
    expect(readMusicXml(xml).measures[0]).toEqual([
      { pitch: null, type: 'whole', dotted: false },
      { pitch: null, type: 'quarter', dotted: false },
    ])
  })

  it('rejects unsupported polyphony, malformed XML and entity declarations', () => {
    const xml = writeMusicXml(fillScoreMeasure(EMPTY_SCORE, 0))
    expect(() => readMusicXml(xml.replace('<rest/>', '<chord/><rest/>'))).toThrow()
    expect(() => readMusicXml(xml.replace('</part>', ''))).toThrow()
    expect(() => readMusicXml(xml.replace('<score-partwise', '<!DOCTYPE score-partwise [<!ENTITY test "bad">]><score-partwise'))).toThrow()
  })
})
