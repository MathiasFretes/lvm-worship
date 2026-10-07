import { describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { getDisplayName, timeGreetingKey } from '../greetings'

function user(email: string | undefined, metadata: Record<string, unknown>): User {
  return { email, user_metadata: metadata } as User
}

describe('timeGreetingKey', () => {
  it.each([
    [5, 'greeting.morning'],
    [12, 'greeting.afternoon'],
    [18, 'greeting.evening'],
  ])('maps hour %i to %s', (hour, expected) => {
    const date = new Date(2026, 0, 1, hour)
    expect(timeGreetingKey(date)).toBe(expected)
  })
})

describe('getDisplayName', () => {
  it('prefers the first provider name token', () => {
    expect(getDisplayName(user('fallback@example.com', { full_name: '  Ada Lovelace  ' }))).toBe(
      'Ada',
    )
  })

  it('falls back from malformed metadata to the email local part', () => {
    expect(getDisplayName(user('mathias@example.com', { full_name: 42 }))).toBe('mathias')
  })

  it('returns null when identity has no usable name', () => {
    expect(getDisplayName(user(undefined, { name: '   ' }))).toBeNull()
  })
})
