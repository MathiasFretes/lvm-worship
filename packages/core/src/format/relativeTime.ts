// Compact relative timestamp for setlist metadata: "just now", "5m ago",
// "3h ago", "2d ago", then a localized "Mar 16" beyond a month. Platform-free:
// the caller passes its i18n `t` (common namespace) and the active locale, so
// web and mobile render the same string from their own translation files.

export type Translator = (key: string, options?: Record<string, unknown>) => string

const MINUTE_MS = 60_000
const RELATIVE_UNITS = [
  { ceiling: 60, divisor: 1, key: 'timeAgo.minutes' },
  { ceiling: 24 * 60, divisor: 60, key: 'timeAgo.hours' },
  { ceiling: 31 * 24 * 60, divisor: 24 * 60, key: 'timeAgo.days' },
] as const

export function timeAgo(
  iso: string | null | undefined,
  t: Translator,
  locale?: string
): string | null {
  if (!iso) return null
  const date = new Date(iso)
  const then = date.getTime()
  if (Number.isNaN(then)) return null
  const mins = Math.floor((Date.now() - then) / MINUTE_MS)
  if (mins < 1) return t('timeAgo.justNow')
  const relative = RELATIVE_UNITS.find(({ ceiling }) => mins < ceiling)
  if (relative) {
    return t(relative.key, { count: Math.floor(mins / relative.divisor) })
  }
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
