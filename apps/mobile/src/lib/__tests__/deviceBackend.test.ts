import { afterEach, expect, it, vi } from 'vitest'
import { createDeviceBackend } from '../deviceBackend'
const apiUrl = 'https://srv2137598.hstgr.cloud/api'
const session = { access_token: `n_${'b'.repeat(43)}`, expires_at: 2100000000, user: { id: 'owner', email: 'owner@example.com' } }
function setup() {
  const entries = new Map<string, string>()
  let offline = false
  let revoked = false
  const fetcher = vi.fn().mockImplementation(async (url: string) => {
    if (offline) throw new Error('Offline')
    if (url.endsWith('/login')) return new Response(JSON.stringify({ session, user: session.user }))
    if (url.endsWith('/session')) return new Response(JSON.stringify({ session: revoked ? null : { user: session.user } }))
    return new Response('{}')
  })
  const store = { getItem: async (key: string) => entries.get(key) || null, setItem: async (key: string, value: string) => { entries.set(key, value) }, removeItem: async (key: string) => { entries.delete(key) } }
  return { ...createDeviceBackend({ apiUrl, storage: store, fetcher }), entries, fetcher, disconnect: () => { offline = true }, revoke: () => { revoked = true } }
}
afterEach(() => vi.useRealTimers())
it('restores an unexpired device session during offline boot and clears local credentials on offline logout', async () => {
  const app = setup()
  await app.client.auth.signInWithPassword({ email: 'owner@example.com', password: 'secret' })
  const callback = vi.fn()
  const subscription = app.client.auth.onAuthStateChange(callback)
  await vi.waitFor(() => expect(callback).toHaveBeenCalled())
  app.disconnect()
  const offline = await app.client.auth.getSession()
  expect(offline.data.session.user.id).toBe('owner')
  expect(offline.error).toBeTruthy()
  await app.client.auth.signOut()
  expect(app.entries.size).toBe(0)
  expect(callback).toHaveBeenLastCalledWith('SIGNED_OUT', null)
  expect((await app.client.auth.getSession()).data.session).toBeNull()
  subscription.data.subscription.unsubscribe()
})
it('foreground validation removes a revoked session and stops when the app backgrounds', async () => {
  const app = setup()
  await app.client.auth.signInWithPassword({ email: 'owner@example.com', password: 'secret' })
  const callback = vi.fn()
  const subscription = app.client.auth.onAuthStateChange(callback)
  await vi.waitFor(() => expect(callback).toHaveBeenCalled())
  app.revoke()
  app.client.auth.startAutoRefresh()
  await vi.waitFor(() => expect(callback).toHaveBeenLastCalledWith('SIGNED_OUT', null))
  expect(await app.readStoredSession()).toBeNull()
  app.client.auth.stopAutoRefresh()
  subscription.data.subscription.unsubscribe()
})
it('supports local-only logout without sending credentials or accidentally revoking the replacement password session', async () => {
  const app = setup()
  await app.client.auth.signInWithPassword({ email: 'owner@example.com', password: 'secret' })
  const before = app.fetcher.mock.calls.length
  expect((await app.client.auth.signOut({ scope: 'others' })).error).toBeTruthy()
  expect(await app.readStoredSession()).toBeTruthy()
  await app.client.auth.signOut({ scope: 'local' })
  expect(app.fetcher).toHaveBeenCalledTimes(before)
  expect(await app.readStoredSession()).toBeNull()
})

it('does not emit a late login when local logout starts during secure credential persistence', async () => {
  let stored: string | null = null
  let releaseWrite!: () => void
  let writeStarted!: () => void
  const started = new Promise<void>(resolve => { writeStarted = resolve })
  const blocked = new Promise<void>(resolve => { releaseWrite = resolve })
  const app = createDeviceBackend({ apiUrl,
    storage: {
      getItem: async () => stored,
      setItem: async (_key, value) => { writeStarted(); await blocked; stored = value },
      removeItem: async () => { stored = null },
    },
    fetcher: async input => new Response(JSON.stringify(String(input).endsWith('/login') ? { session, user: session.user } : { session: null })),
  })
  const callback = vi.fn()
  const subscription = app.client.auth.onAuthStateChange(callback)
  await vi.waitFor(() => expect(callback).toHaveBeenCalledWith('INITIAL_SESSION', null))
  const login = app.client.auth.signInWithPassword({ email: 'owner@example.com', password: 'secret' })
  await started
  const logout = app.client.auth.signOut({ scope: 'local' })
  releaseWrite()
  const [loginResult] = await Promise.all([login, logout])
  expect(loginResult.error).toBeTruthy()
  expect(callback.mock.calls.some(([event]) => event === 'SIGNED_IN')).toBe(false)
  expect(callback).toHaveBeenLastCalledWith('SIGNED_OUT', null)
  expect(await app.readStoredSession()).toBeNull()
  subscription.data.subscription.unsubscribe()
})
