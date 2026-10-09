// Pure i18n config + app-language resolution (RN-free, unit-tested headless).
// Mirrors apps/web/src/i18n/config.js. The supported-locale list itself is
// derived from the locale folders in resources.ts — this module only holds the
// pieces that can't come from the filesystem (labels, resolution rules).

export const DEFAULT_LOCALE = 'en' as const

// LVM keeps the picker names explicit because Hermes does not guarantee
// Intl.DisplayNames data. `satisfies` catches accidental non-string labels
// without widening the known locale keys.
const LVM_LOCALE_LABELS = {
  en: 'English',
  es: 'Español',
  ko: '한국어',
  tr: 'Türkçe',
} as const satisfies Record<string, string>

export function localeLabel(code: string): string {
  return LVM_LOCALE_LABELS[code as keyof typeof LVM_LOCALE_LABELS] ?? code.toUpperCase()
}

/** 'ko-KR' / 'en_US' → 'ko' / 'en'. Empty input stays empty. */
export function normalizeLanguageTag(tag: unknown): string {
  const normalized = typeof tag === 'string' ? tag.trim().toLowerCase() : ''
  return normalized.split(/[-_]/, 1)[0]
}

/**
 * Resolve the app UI language, in order: the user's stored explicit pick when
 * it's a supported locale → the first supported device language → English.
 * `stored` null/'' means "follow the device."
 */
export function resolveLanguage(
  stored: string | null | undefined,
  deviceTags: readonly string[],
  supported: readonly string[]
): string {
  const available = new Set(supported)
  const pick = normalizeLanguageTag(stored)
  if (pick && available.has(pick)) return pick

  for (const tag of deviceTags) {
    const base = normalizeLanguageTag(tag)
    if (base && available.has(base)) return base
  }

  return DEFAULT_LOCALE
}
