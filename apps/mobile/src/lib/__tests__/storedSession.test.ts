import { describe, expect, it, vi } from 'vitest'
import { authStorageKey, makeStoredSessionReader, parseStoredSession } from '../storedSession'

describe('authStorageKey', () => {
  // Must match auth-js's own default exactly — a different key points at an
  // empty slot, which would sign every user out on upgrade.
  it('derives sb-<project ref>-auth-token from the Supabase URL', () => {
    expect(authStorageKey('https://abcdefgh.supabase.co')).toBe('sb-abcdefgh-auth-token')
    expect(authStorageKey('https://abcdefgh.supabase.co/')).toBe('sb-abcdefgh-auth-token')
    expect(authStorageKey('http://abcdefgh.supabase.co')).toBe('sb-abcdefgh-auth-token')
  })

  it('does not throw on an empty or malformed URL', () => {
    expect(() => authStorageKey('')).not.toThrow()
    expect(() => authStorageKey('not a url')).not.toThrow()
  })

  it('accepts uppercase URL schemes', () => {
    expect(authStorageKey('HTTPS://abcdefgh.supabase.co/path')).toBe('sb-abcdefgh-auth-token')
  })
})

describe('parseStoredSession', () => {
  const session = { access_token: 'a', refresh_token: 'r', user: { id: 'u' } }

  it('reads the bare session shape', () => {
    expect(parseStoredSession(JSON.stringify(session))).toMatchObject({ refresh_token: 'r' })
  })

  it('reads the legacy { currentSession } wrapper', () => {
    expect(parseStoredSession(JSON.stringify({ currentSession: session }))).toMatchObject({
      refresh_token: 'r',
    })
  })

  it('rejects anything without both tokens — an unusable session is not a session', () => {
    expect(parseStoredSession(JSON.stringify({ access_token: 'a' }))).toBeNull()
    expect(parseStoredSession(JSON.stringify({ refresh_token: 'r' }))).toBeNull()
  })

  it('returns null rather than throwing on junk', () => {
    expect(parseStoredSession(null)).toBeNull()
    expect(parseStoredSession('')).toBeNull()
    expect(parseStoredSession('{not json')).toBeNull()
    expect(parseStoredSession('"a string"')).toBeNull()
  })
})

describe('makeStoredSessionReader', () => {
  it('reads auth-js storage through the injected adapter', async () => {
    const raw = JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'u' } })
    const storage = { getItem: vi.fn().mockResolvedValue(raw) }
    const read = makeStoredSessionReader('https://project.supabase.co', storage)

    await expect(read()).resolves.toMatchObject({ user: { id: 'u' } })
    expect(storage.getItem).toHaveBeenCalledWith('sb-project-auth-token')
  })

  it('treats storage failures as an unavailable offline session', async () => {
    const storage = { getItem: vi.fn().mockRejectedValue(new Error('unavailable')) }
    await expect(makeStoredSessionReader('https://project.supabase.co', storage)()).resolves.toBeNull()
  })
})
