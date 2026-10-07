export function publicUrl(input = '') {
  const raw = String(input ?? '').trim()
  if (!raw) return '/'
  if (/^(?:https?:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) return raw

  const suffixAt = raw.search(/[?#]/)
  const path = suffixAt >= 0 ? raw.slice(0, suffixAt) : raw
  const suffix = suffixAt >= 0 ? raw.slice(suffixAt) : ''
  let cleaned = path.replace(/^\.\/+/, '')
  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`
  cleaned = cleaned.replace(/\/{2,}/g, '/')

  if (import.meta?.env?.DEV) {
    if (cleaned.includes('/songs/songs/') || cleaned.includes('/resources/resources/')) {
      console.warn('publicUrl produced a double segment:', cleaned)
    }
  }

  return `${cleaned}${suffix}`
}
