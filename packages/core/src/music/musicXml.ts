import { DOMParser, type Element } from '@xmldom/xmldom'
import {
  DURATIONS, EMPTY_SCORE, METERS, SCORE_DIVISIONS, SCORE_MAX_BYTES, SCORE_MAX_MEASURES, STEPS,
  measureTicks, meterTicks, noteTicks, scoreRests, scoreStaff, type Score, type ScoreDuration, type ScoreNote, type ScorePitch,
} from './score'

const children = (parent: Element, name?: string) => Array.from(parent.childNodes)
  .filter((node): node is Element => node.nodeType === 1)
  .filter(node => !name || node.localName === name)
const child = (parent: Element | undefined, name: string) => parent && children(parent, name)[0]
const content = (parent: Element | undefined, name: string) => child(parent, name)?.textContent?.trim() ?? ''
const present = (parent: Element, names: string[]) => names.some(name => child(parent, name))
const invalid = () => new Error('Unsupported or invalid MusicXML')
const durations = Object.keys(DURATIONS) as ScoreDuration[]

function parseNote(element: Element, divisions: number, measureLength: number): ScoreNote[] {
  if (present(element, ['chord', 'tie', 'grace', 'cue', 'unpitched', 'time-modification', 'notations', 'lyric']) ||
      (content(element, 'voice') && content(element, 'voice') !== '1') ||
      (content(element, 'staff') && content(element, 'staff') !== '1')) throw invalid()
  const ticks = Number(content(element, 'duration')) * SCORE_DIVISIONS / divisions
  const rest = child(element, 'rest')
  if (rest?.getAttribute('measure') === 'yes' && ticks === measureLength) return scoreRests(ticks)
  let pitch: ScorePitch | null = null
  if (!rest) {
    const written = child(element, 'pitch')
    const step = content(written, 'step') as ScorePitch['step']
    const octave = Number(content(written, 'octave'))
    const alter = Number(content(written, 'alter')) as ScorePitch['alter']
    if (!STEPS.includes(step) || !Number.isInteger(octave) || octave < 2 || octave > 7 ||
        ![-1, 0, 1].includes(alter)) throw invalid()
    pitch = { step, octave, alter }
  }
  const rawType = content(element, 'type')
  const dots = children(element, 'dot').length
  if (dots > 1 || !Number.isInteger(ticks) || ticks <= 0) throw invalid()
  if (rawType && durations.includes(rawType as ScoreDuration)) {
    const note = { pitch, type: rawType as ScoreDuration, dotted: dots === 1 }
    if (noteTicks(note) === ticks) return [note]
  }
  const inferred = durations.flatMap(type => [false, true].map(dotted => ({ pitch, type, dotted })))
    .find(note => noteTicks(note) === ticks)
  if (inferred && !rawType) return [inferred]
  throw invalid()
}

export function readMusicXml(xml: string): Score {
  if (xml.length > SCORE_MAX_BYTES || /<!ENTITY|<!DOCTYPE[^>]*\[/i.test(xml)) throw invalid()
  const document = new DOMParser({ onError: () => { throw invalid() } }).parseFromString(xml, 'application/xml')
  const root = document.documentElement
  if (!root || root.localName !== 'score-partwise' || root.namespaceURI) throw invalid()
  const parts = children(root, 'part')
  if (parts.length !== 1) throw invalid()
  const bars = children(parts[0], 'measure')
  if (!bars.length || bars.length > SCORE_MAX_MEASURES) throw invalid()
  const score: Score = {
    ...EMPTY_SCORE,
    title: (content(root, 'movement-title') || content(child(root, 'work'), 'work-title')).slice(0, 120),
    measures: [],
  }
  let divisions = 1
  let tempo = 0
  for (const [index, bar] of bars.entries()) {
    const attributes = child(bar, 'attributes')
    if (present(bar, ['backup', 'forward', 'harmony', 'sound']) || bar.getElementsByTagName('repeat').length > 0 ||
        bar.getElementsByTagName('ending').length > 0 || (attributes && present(attributes, ['transpose']))) throw invalid()
    if (attributes && Number(content(attributes, 'staves') || '1') !== 1) throw invalid()
    const divisionValue = content(attributes, 'divisions')
    if (divisionValue) divisions = Number(divisionValue)
    if (!Number.isInteger(divisions) || divisions <= 0) throw invalid()
    const time = child(attributes, 'time')
    if (time) {
      const meter = `${content(time, 'beats')}/${content(time, 'beat-type')}` as Score['meter']
      if (children(time, 'beats').length !== 1 || !METERS.includes(meter) || (index > 0 && meter !== score.meter)) throw invalid()
      score.meter = meter
    }
    const clef = child(attributes, 'clef')
    if (clef) {
      const sign = content(clef, 'sign')
      const line = content(clef, 'line')
      if (present(clef, ['clef-octave-change']) || (sign !== 'G' && sign !== 'F') ||
          (line && line !== (sign === 'G' ? '2' : '4')) || (index > 0 && sign !== score.clef)) throw invalid()
      score.clef = sign
    }
    for (const direction of children(bar, 'direction')) {
      const sound = child(direction, 'sound')
      const metronome = child(child(direction, 'direction-type'), 'metronome')
      const explicit = sound?.getAttribute('tempo') || (content(metronome, 'beat-unit') === 'quarter' ? content(metronome, 'per-minute') : '')
      if (!explicit) continue
      const next = Number(explicit)
      if (!Number.isInteger(next) || next < 30 || next > 300 || (tempo && next !== tempo) || (!tempo && index > 0)) throw invalid()
      tempo = next
    }
    const length = meterTicks(score.meter)
    const notes = children(bar, 'note').flatMap(note => parseNote(note, divisions, length))
    if (measureTicks(notes) > length) throw invalid()
    score.measures.push(notes)
  }
  if (tempo) score.tempo = tempo
  return score
}

const escape = (value: string) => value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!)

export function writeMusicXml(score: Score) {
  const [beats, beatType] = score.meter.split('/')
  const clefLine = score.clef === 'G' ? 2 : 4
  const bars = score.measures.map((notes, index) => {
    if (measureTicks(notes) !== meterTicks(score.meter)) throw new Error('Complete the score before export')
    const attributes = index === 0 ? `<attributes><divisions>${SCORE_DIVISIONS}</divisions><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time><clef><sign>${score.clef}</sign><line>${clefLine}</line></clef></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute></metronome></direction-type><sound tempo="${score.tempo}"/></direction>` : ''
    const staff = scoreStaff(notes, score.clef)
    const written = notes.map((note, i) => {
      const pitch = note.pitch
        ? `<pitch><step>${note.pitch.step}</step>${note.pitch.alter ? `<alter>${note.pitch.alter}</alter>` : ''}<octave>${note.pitch.octave}</octave></pitch>`
        : '<rest/>'
      const symbol = staff.notes[i].accidental
      const accidental = symbol && `<accidental>${symbol === '♯' ? 'sharp' : symbol === '♭' ? 'flat' : 'natural'}</accidental>`
      return `<note>${pitch}<duration>${noteTicks(note)}</duration><type>${note.type}</type>${note.dotted ? '<dot/>' : ''}${accidental}</note>`
    }).join('\n')
    return `<measure number="${index + 1}">\n${attributes}\n${written}\n</measure>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0"><movement-title>${escape(score.title)}</movement-title><part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list><part id="P1">\n${bars}\n</part></score-partwise>\n`
}
