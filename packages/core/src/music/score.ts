export const SCORE_MAX_BYTES = 512 * 1024
export const SCORE_MAX_MEASURES = 128
export const SCORE_DIVISIONS = 8
export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export const DURATIONS = { whole: 32, half: 16, quarter: 8, eighth: 4, '16th': 2, '32nd': 1 } as const
export const REST_SYMBOLS = { whole: '𝄻', half: '𝄼', quarter: '𝄽', eighth: '𝄾', '16th': '𝄿', '32nd': '𝅀' } as const
export const METERS = ['2/4', '3/4', '4/4', '5/4', '6/8', '9/8', '12/8'] as const
export type ScoreMeter = typeof METERS[number]
export type ScoreDuration = keyof typeof DURATIONS
export type ScorePitch = { step: typeof STEPS[number]; octave: number; alter: -1 | 0 | 1 }
export type ScoreNote = { pitch: ScorePitch | null; type: ScoreDuration; dotted: boolean }
export type Score = { title: string; tempo: number; meter: ScoreMeter; clef: 'G' | 'F'; measures: ScoreNote[][] }

export const EMPTY_SCORE: Score = { title: '', tempo: 96, meter: '4/4', clef: 'G', measures: [[]] }
export const DEFAULT_SCORE_NOTE: ScoreNote = { pitch: { step: 'C', octave: 4, alter: 0 }, type: 'quarter', dotted: false }

export function noteTicks(note: Pick<ScoreNote, 'type' | 'dotted'>) {
  return DURATIONS[note.type] * (note.dotted ? 1.5 : 1)
}

export function meterTicks(meter: ScoreMeter) {
  const [beats, unit] = meter.split('/').map(Number)
  return beats * 4 * SCORE_DIVISIONS / unit
}

export function measureTicks(notes: ScoreNote[]) {
  return notes.reduce((sum, note) => sum + noteTicks(note), 0)
}

export function editScoreNote(score: Score, measure: number, index: number, note: ScoreNote | null) {
  const notes = score.measures[measure]
  if (!notes || index < 0 || index > notes.length || (note && (!Number.isInteger(noteTicks(note)) ||
      (note.pitch && (!Number.isInteger(note.pitch.octave) || note.pitch.octave < 2 || note.pitch.octave > 7))))) return null
  const next = notes.slice()
  next.splice(index, index === notes.length ? 0 : 1, ...(note ? [note] : []))
  if (measureTicks(next) > meterTicks(score.meter)) return null
  return { ...score, measures: score.measures.map((bar, i) => i === measure ? next : bar) }
}

export function fillScoreMeasure(score: Score, measure: number): Score {
  const notes = score.measures[measure]
  const rests = scoreRests(meterTicks(score.meter) - measureTicks(notes))
  return { ...score, measures: score.measures.map((bar, i) => i === measure ? [...bar, ...rests] : bar) }
}

export function scoreRests(ticks: number): ScoreNote[] {
  let remaining = ticks
  const rests: ScoreNote[] = []
  for (const [type, ticks] of Object.entries(DURATIONS)) {
    while (remaining >= ticks) {
      rests.push({ pitch: null, type: type as ScoreDuration, dotted: false })
      remaining -= ticks
    }
  }
  return rests
}

export function parseScoreDraft(raw: string): Score {
  const score: Score = JSON.parse(raw)
  if (!score || typeof score.title !== 'string' || score.title.length > 120 ||
      !Number.isInteger(score.tempo) || score.tempo < 30 || score.tempo > 300 ||
      !METERS.includes(score.meter) || !['G', 'F'].includes(score.clef) ||
      !Array.isArray(score.measures) || score.measures.length === 0 || score.measures.length > SCORE_MAX_MEASURES) {
    throw new Error('Invalid score draft')
  }
  for (const notes of score.measures) {
    if (!Array.isArray(notes) || notes.length > meterTicks(score.meter) || notes.some(note =>
      !note || !Object.hasOwn(DURATIONS, note.type) || typeof note.dotted !== 'boolean' ||
      !Number.isInteger(noteTicks(note)) || (note.pitch !== null && (!note.pitch ||
        !STEPS.includes(note.pitch.step) || !Number.isInteger(note.pitch.octave) || note.pitch.octave < 2 ||
        note.pitch.octave > 7 || ![-1, 0, 1].includes(note.pitch.alter)))) || measureTicks(notes) > meterTicks(score.meter)) {
      throw new Error('Invalid score measure')
    }
  }
  return score
}

export function scoreStaff(notes: ScoreNote[], clef: Score['clef']) {
  const bottomLine = clef === 'G' ? 4 * 7 + 2 : 2 * 7 + 4
  const staffPositions = notes.map(({ pitch }) => pitch ? pitch.octave * 7 + STEPS.indexOf(pitch.step) - bottomLine : 4)
  const top = Math.max(10, ...staffPositions)
  const bottom = Math.min(-2, ...staffPositions)
  const y = (step: number) => 20 + (top - step) * 6
  const previous = new Map<string, number>()
  return {
    height: y(bottom) + 20,
    lines: [0, 2, 4, 6, 8].map(y),
    notes: staffPositions.map((step, index) => {
      const pitch = notes[index].pitch
      let accidental = ''
      if (pitch) {
        const key = `${pitch.step}${pitch.octave}`
        if ((previous.get(key) ?? 0) !== pitch.alter) accidental = pitch.alter === 1 ? '♯' : pitch.alter === -1 ? '♭' : '♮'
        previous.set(key, pitch.alter)
      }
      const ledgers = []
      if (step < 0) for (let line = -2; line >= step; line -= 2) ledgers.push(y(line))
      else for (let line = 10; line <= step; line += 2) ledgers.push(y(line))
      return { y: y(step), ledgers, stemDown: step >= 4, accidental }
    }),
  }
}
