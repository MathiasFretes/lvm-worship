const PITCHES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const QUALITIES = {
  '': [0, 4, 7], m: [0, 3, 7], '5': [0, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mMaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 2], madd9: [0, 3, 7, 2],
  '9': [0, 4, 7, 10, 2], maj9: [0, 4, 7, 11, 2], m9: [0, 3, 7, 10, 2],
  '11': [0, 4, 7, 10, 2, 5], m11: [0, 3, 7, 10, 2, 5],
  '13': [0, 4, 7, 10, 2, 9], '7b9': [0, 4, 7, 10, 1], '7#9': [0, 4, 7, 10, 3],
}

export const PRACTICE_INSTRUMENTS = {
  guitar: [40, 45, 50, 55, 59, 64],
  ukulele: [67, 60, 64, 69],
  cavaquinho: [62, 67, 71, 74],
  viola: [47, 52, 56, 59, 64],
  keyboard: null,
}

export function notePitch(note) {
  const match = /^([A-G])([#b]?)$/.exec(String(note))
  if (!match) return null
  return (PITCHES[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0) + 12) % 12
}

export function pitchName(pitch, flats = false) {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((pitch % 12) + 12) % 12]
}

export function describeChord(symbol) {
  const match = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(String(symbol).trim())
  if (!match) return null
  const quality = match[2].replace(/^min/, 'm').replace(/^\+$/, 'aug').replace(/^°$/, 'dim').replace(/^Δ/, 'maj')
  const intervals = QUALITIES[quality]
  if (!intervals) return null
  const root = notePitch(match[1])
  const bass = match[3] ? notePitch(match[3]) : root
  const pitches = [...new Set(intervals.map(interval => (root + interval) % 12))]
  if (!pitches.includes(bass)) pitches.push(bass)
  return { symbol, root, bass, pitches, quality }
}

export function fingeringForFrets(frets) {
  const fingers = frets.map(() => 0)
  const barres = []
  let count = 0
  for (const fret of [...new Set(frets.filter(value => value > 0))].sort((a, b) => a - b)) {
    const indices = frets.flatMap((value, index) => value === fret ? [index] : [])
    const groups = []
    for (const index of indices) {
      const group = groups.at(-1)
      if (!group || frets.slice(group.at(-1) + 1, index).some(value => value < fret)) groups.push([index])
      else group.push(index)
    }
    for (const group of groups) {
      count++
      group.forEach(index => { fingers[index] = count })
      if (group.length > 1) barres.push({ fret, start: group[0], end: group.at(-1) })
    }
  }
  return { count, fingers, barres }
}

// Enumerate playable positions rather than displaying an unrelated fallback chord.
// Every diagram contains the requested bass/root and only notes from the chord.
export function chordVoicings(symbol, instrument = 'guitar', limit = 5) {
  const chord = describeChord(symbol)
  const tuning = PRACTICE_INSTRUMENTS[instrument]
  if (!chord || !tuning) return []
  const results = new Map()
  const required = chord.pitches.length > tuning.length
    ? [chord.root, ...chord.pitches.filter(pitch => pitch !== (chord.root + 7) % 12)].slice(0, tuning.length)
    : chord.pitches
  for (let position = 0; position <= 12; position++) {
    const choices = tuning.map(open => [-1, ...Array.from({ length: 4 }, (_, index) => position + index)
      .filter(fret => fret <= 15 && chord.pitches.includes((open + fret) % 12))])
    function visit(frets) {
      if (frets.length < tuning.length) {
        for (const fret of choices[frets.length]) visit([...frets, fret])
        return
      }
      const notes = frets.flatMap((fret, index) => fret < 0 ? [] : [tuning[index] + fret])
      if (notes.length < Math.min(3, required.length)) return
      if (Math.min(...notes) % 12 !== chord.bass) return
      if (!required.every(pitch => notes.some(note => note % 12 === pitch))) return
      const fingers = frets.filter(fret => fret > 0)
      if (fingers.length && Math.max(...fingers) - Math.min(...fingers) > 3) return
      const fingering = fingeringForFrets(frets)
      if (fingering.count > 4) return
      const score = Math.max(0, ...frets) * 2 + frets.filter(fret => fret < 0).length * 3 + fingering.count
      results.set(frets.join(','), { frets, notes, score, ...fingering, position: Math.max(0, ...frets) <= 4 ? 1 : Math.min(...fingers) })
    }
    visit([])
  }
  return [...results.values()].sort((a, b) => a.score - b.score).slice(0, limit)
}

export function keyboardVoicing(symbol) {
  const chord = describeChord(symbol)
  if (!chord) return []
  const base = 48 + chord.root
  const notes = chord.pitches.map(pitch => base + ((pitch - chord.root + 12) % 12)).sort((a, b) => a - b)
  if (chord.bass !== chord.root) notes.unshift(36 + chord.bass)
  return notes
}

export function collectSongChords(blocks, transpose) {
  const symbols = []
  for (const block of blocks || []) for (const line of block.lines || []) {
    for (const symbol of line.instrumental?.chords || []) symbols.push(transpose(symbol))
    for (const chord of line.chords || []) {
      const symbol = typeof chord === 'string' ? chord : chord.sym || chord.chord || chord.symbol
      if (symbol) symbols.push(transpose(symbol))
    }
  }
  return [...new Set(symbols)]
}

export function midiFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12)
}
