import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Session } from '@supabase/supabase-js'

// Reads the session supabase-js persisted, without the network.
//
// This exists for one case: a launch where getSession() cannot confirm the
// session because the device is offline. See readStoredSessionSafely in
// authSession.ts for why an unconfirmable session is not a signed-out one.
//
// It reads auth-js's own storage entry rather than adding a second copy of the
// session on disk. Two copies would need keeping in sync on every refresh, sign
// out and token rotation, and the failure mode of a stale duplicate is exactly
// the bug this is meant to fix, wearing a different hat.

/**
 * auth-js's default storage key, recomputed rather than configured.
 *
 * It derives the key as `sb-<project ref>-auth-token`, where the project ref is
 * the first label of the Supabase URL's hostname. Passing an explicit
 * `storageKey` to createClient would be tidier, but any value other than this
 * one points at an empty slot — which would sign out every user on the device
 * the moment they updated. So it is mirrored, not set.
 */
export function authStorageKey(supabaseUrl: string): string {
  const value = String(supabaseUrl ?? '').trim()
  let host = value.replace(/^https?:\/\//i, '').split('/')[0]
  try {
    host = new URL(value).hostname || host
  } catch {
    // Keep auth-js's permissive string derivation for malformed configuration.
  }
  const [ref = ''] = host.split('.')
  return `sb-${ref}-auth-token`
}

/** Parse auth-js's stored blob into a Session, or null if it isn't one. */
export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    // auth-js has stored both the bare session and a { currentSession } wrapper
    // across versions; accept either rather than pinning to today's shape.
    const session =
      parsed && typeof parsed === 'object' && 'currentSession' in parsed
        ? (parsed as { currentSession?: unknown }).currentSession
        : parsed
    if (!session || typeof session !== 'object') return null
    const candidate = session as Record<string, unknown>
    if (
      typeof candidate.access_token !== 'string' ||
      typeof candidate.refresh_token !== 'string' ||
      !candidate.access_token ||
      !candidate.refresh_token
    ) {
      return null
    }
    return session as Session
  } catch {
    return null
  }
}

type SessionStorage = Pick<typeof AsyncStorage, 'getItem'>

export function makeStoredSessionReader(
  supabaseUrl: string,
  storage: SessionStorage = AsyncStorage,
) {
  const key = authStorageKey(supabaseUrl)
  return async (): Promise<Session | null> => {
    try {
      return parseStoredSession(await storage.getItem(key))
    } catch {
      return null
    }
  }
}
