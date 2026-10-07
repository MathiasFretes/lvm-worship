// src/utils/songs/chords.js
// Helper to parse chord tokens and compute x positions with collision resolution

/**
 * Parse a lyric line containing [CHORD] tokens.
 * @param {string} line
 * @param {(text: string) => number} measureLyric  function returning width of lyric text
 * @param {(text: string) => number} measureChord  function returning width of chord text
 * @returns {{ lyrics: string, chords: Array<{ sym: string, x: number, w: number }> }}
 */
export function parseChordLine(line = '', measureLyric = s => s.length, measureChord = s => s.length) {
  const chords = []
  let lyrics = ''
  let x = 0
  let cursor = 0
  while (cursor < line.length) {
    const open = line.indexOf('[', cursor)
    const close = open < 0 ? -1 : line.indexOf(']', open + 1)
    if (open < 0 || close < 0) break
    const before = line.slice(cursor, open)
    lyrics += before
    x += measureLyric(before)
    const sym = line.slice(open + 1, close)
    const w = measureChord(sym)
    chords.push({ sym, x, w })
    cursor = close + 1
  }
  lyrics += line.slice(cursor)
  const spaceW = measureLyric(' ')
  resolveChordCollisions(chords, spaceW)
  return { lyrics, chords }
}

/**
 * Resolve chord collisions by nudging left/right so neighbors stay at least
 * `spaceWidth` apart.
 * @param {Array<{x:number,w:number}>} chords
 * @param {number} spaceWidth  minimum desired gap between chords
 * @param {number} maxIter
 * @returns {Array}
 */
export function resolveChordCollisions(chords, spaceWidth = 0, maxIter = 10) {
  if (!Array.isArray(chords) || chords.length < 2) return chords
  chords.sort((a, b) => a.x - b.x)
  for (let iteration = 0; iteration < maxIter; iteration += 1) {
    let changed = false
    for (let i = 1; i < chords.length; i++) {
      const prev = chords[i - 1]
      const cur = chords[i]
      const gap = cur.x - (prev.x + prev.w)
      if (gap < spaceWidth) {
        const shift = Math.ceil((spaceWidth - gap) / 2)
        prev.x -= shift
        cur.x += shift
        changed = true
      }
    }
    if (!changed) break
  }
  chords.sort((a, b) => a.x - b.x)
  return chords
}

