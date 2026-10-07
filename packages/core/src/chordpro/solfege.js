// Turkish-style fixed-do solfège mapping for chord display.
// Letter-based ChordPro stays canonical; this is presentation only.

const ROOT_TO_SOLFEGE = {
  C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si',
}

export function rootToSolfege(rootWithAcc) {
  const m = String(rootWithAcc || '').match(/^([A-G])([#b]?)$/)
  if (!m) return rootWithAcc
  const [, base, acc] = m
  return (ROOT_TO_SOLFEGE[base] || base) + (acc || '')
}

export function symToSolfege(sym) {
  if (!sym) return sym
  const s = String(sym)
  const slash = s.indexOf('/')
  if (slash >= 0) {
    return symToSolfege(s.slice(0, slash)) + '/' + symToSolfege(s.slice(slash + 1).split('/')[0])
  }
  const match = s.match(/^([A-G][#b]?)(.*)$/)
  return match ? rootToSolfege(match[1]) + (match[2] || '') : s
}

export function formatChord(sym, opts = {}) {
  if (!sym) return sym
  if (opts.style === 'solfege') return symToSolfege(sym)
  return String(sym)
}

export function formatKeyDisplay(key, style = 'letters') {
  if (!key) return key
  if (style === 'solfege') return symToSolfege(key)
  return String(key)
}

// Convenience: transpose a chord and apply the configured display style.
// Intentionally takes the underlying transposer as a parameter to avoid a
// circular import with chordpro/index.js.
export function transposeAndFormat(transposeFn, sym, steps, preferFlat, style = 'letters') {
  const t = typeof transposeFn === 'function' ? transposeFn(sym, steps, preferFlat) : sym
  return formatChord(t, { style })
}
