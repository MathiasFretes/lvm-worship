const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'off'])

export function isIncompleteSong(song){
  const v = song?.incomplete
  if (typeof v === 'boolean') return v
  if (v === undefined || v === null) return false
  const s = String(v).trim().toLowerCase()
  if (!s) return false
  if (TRUE_VALUES.has(s)) return true
  if (FALSE_VALUES.has(s)) return false
  return false
}
