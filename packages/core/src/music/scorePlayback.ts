import { meterTicks, noteTicks, SCORE_DIVISIONS, type Score, type ScoreNote } from './score'
import type { TabPlaybackMeasure } from './tablaturePlayback'

const pitchClass = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function buildScorePlayback(score: Score): TabPlaybackMeasure[] {
  const columns = meterTicks(score.meter)
  const [numerator, unit] = score.meter.split('/').map(Number)
  const clicks = unit === 8 && numerator % 3 === 0 ? numerator / 3 : numerator
  return score.measures.map((entries, measure) => {
    let column = 0
    const notes: TabPlaybackMeasure['notes'] = []
    for (const entry of entries) {
      const length = noteTicks(entry)
      if (entry.pitch) {
        const { step, octave, alter } = entry.pitch
        notes.push({ column, midi: 12 * (octave + 1) + pitchClass[step] + alter, length })
      }
      column += length
    }
    return { system: 0, measure, columns, notes, quarterBeats: columns / SCORE_DIVISIONS, clicks }
  })
}

export function scoreEventAt(notes: ScoreNote[], column: number) {
  let end = 0
  return notes.findIndex(note => {
    end += noteTicks(note)
    return column < end
  })
}
