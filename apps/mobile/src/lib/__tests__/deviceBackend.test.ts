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
