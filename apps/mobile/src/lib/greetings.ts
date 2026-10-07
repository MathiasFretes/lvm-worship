import type { User } from '@supabase/supabase-js'

// The greeting PHRASES live in the home locale namespace
// (src/i18n/locales/<lng>/home.json — greeting.* and the editable subGreetings
// array). This module stays RN/i18n-free (unit-testable) and returns keys or
// indices; Home resolves them through its own `t`.

/** Time-of-day greeting key under home:greeting.*, e.g. 'greeting.morning'. */
export function timeGreetingKey(date: Date = new Date()): string {
  const hour = date.getHours()
  const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return `greeting.${period}`
}

/**
 * The sub-greeting index for this app launch. Chosen once at module load so it
 * stays stable across re-renders and navigation within a session, and varies
 * between launches. Picking here (not on each render) avoids flicker. Home maps
 * it into the home:subGreetings array (modulo its length, so locale files may
 * carry any number of phrases).
 */
const LAUNCH_SUB_GREETING_INDEX = Math.floor(Math.random() * 1024)

export function pickSubGreetingIndex(): number {
  return LAUNCH_SUB_GREETING_INDEX
}

/**
 * A friendly first name for the greeting, derived from the auth user.
 * Returns null when nothing usable exists — callers show the localized
 * home:greeting.friend fallback.
 */
export function getDisplayName(user: User | null): string | null {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const providerName = [meta.full_name, meta.name].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
  if (providerName) return providerName.trim().split(/\s+/, 1)[0]

  const emailName = user?.email?.split('@', 1)[0]?.trim()
  if (emailName) return emailName
  return null
}
