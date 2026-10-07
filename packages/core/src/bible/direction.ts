// Language-direction helpers for Bible translations (DOM-free). Ported from
// apps/web/src/utils/bible/direction.ts.

const RTL_LANGUAGE_CODES: ReadonlySet<string> = new Set([
  'ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'iw', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi',
])

export function normalizeBibleLanguageCode(raw: unknown){
  const normalized = String(raw ?? '').trim().toLowerCase()
  return normalized.includes('_') ? normalized.replaceAll('_', '-') : normalized
}

export function isRtlBibleLanguage(raw: unknown){
  const normalized = normalizeBibleLanguageCode(raw)
  if (!normalized) return false
  const separator = normalized.indexOf('-')
  const base = separator < 0 ? normalized : normalized.slice(0, separator)
  return RTL_LANGUAGE_CODES.has(base)
}
