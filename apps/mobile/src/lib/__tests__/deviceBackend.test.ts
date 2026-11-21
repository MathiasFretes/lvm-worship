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

function pausedJson(body: unknown) {
  let started!: () => void
  let resume!: () => void
  const reading = new Promise<void>(resolve => { started = resolve })
  const waiting = new Promise<void>(resolve => { resume = resolve })
  const response = new Response(JSON.stringify(body))
  const json = response.json.bind(response)
  // Transport validation reads a clone. Pause the caller's separate body read
  // after transport validation and persistence have already completed.
  response.json = async () => { started(); await waiting; return json() }
  return { response, reading, resume }
}

function withFetch(fetcher: typeof fetch) {
  let value: string | null = null
  return createDeviceBackend({ apiUrl, fetcher, storage: {
    getItem: async () => value,
    setItem: async (_key, next) => { value = next },
    removeItem: async () => { value = null },
  } })
}

it('rejects a login decoded after local logout, without notifying the old identity', async () => {
  const pending = pausedJson({ session, user: session.user })
  const app = withFetch(async input => String(input).endsWith('/login') ? pending.response : new Response('{"session":null}'))
  const callback = vi.fn()
  const subscription = app.client.auth.onAuthStateChange(callback)
  await vi.waitFor(() => expect(callback).toHaveBeenCalledWith('INITIAL_SESSION', null))
  const login = app.client.auth.signInWithPassword({ email: 'owner@example.com', password: 'secret' })
  await pending.reading
  await app.client.auth.signOut({ scope: 'local' })
  pending.resume()
  expect((await login).error).toBeTruthy()
  expect(callback.mock.calls.some(([event]) => event === 'SIGNED_IN')).toBe(false)
  expect(callback).toHaveBeenLastCalledWith('SIGNED_OUT', null)
  subscription.data.subscription.unsubscribe()
})

it('does not deliver initial signed-out state after a newer login has completed', async () => {
  const pending = pausedJson({ session: null })
  const app = withFetch(async input => String(input).endsWith('/session') ? pending.response : new Response(JSON.stringify({ session, user: session.user })))
  const callback = vi.fn()
  const subscription = app.client.auth.onAuthStateChange(callback)
  await pending.reading
  await app.client.auth.signInWithPassword({ email: 'owner@example.com', password: 'secret' })
  pending.resume()
  // Let the pending initial subscription finish its promise continuation.
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenLastCalledWith('SIGNED_IN', session)
  expect((await app.readStoredSession())?.user.id).toBe(session.user.id)
  subscription.data.subscription.unsubscribe()
})

it('keeps a replacement account when the previous login finishes decoding later', async () => {
  const pending = pausedJson({ session, user: session.user })
  const replacement = { ...session, access_token: `n_${'c'.repeat(43)}`, user: { id: 'musician', email: 'musician@example.com' } }
  let logins = 0
  const app = withFetch(async input => {
    if (!String(input).endsWith('/login')) return new Response('{"session":null}')
    return ++logins === 1 ? pending.response : new Response(JSON.stringify({ session: replacement, user: replacement.user }))
  })
  const callback = vi.fn()
  const subscription = app.client.auth.onAuthStateChange(callback)
  await vi.waitFor(() => expect(callback).toHaveBeenCalledWith('INITIAL_SESSION', null))
  callback.mockClear()
  const first = app.client.auth.signInWithPassword({ email: 'owner@example.com', password: 'secret' })
  await pending.reading
  const second = await app.client.auth.signInWithPassword({ email: 'musician@example.com', password: 'secret' })
  expect(second.error).toBeNull()
  pending.resume()
  expect((await first).error).toBeTruthy()
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenLastCalledWith('SIGNED_IN', replacement)
  expect((await app.readStoredSession())?.user.id).toBe(replacement.user.id)
  subscription.data.subscription.unsubscribe()
})

it('does not sign out a new account when an older foreground refresh finishes', async () => {
  const pending = pausedJson({ session: null })
  let blockRefresh = false
  const app = withFetch(async input => {
    if (String(input).endsWith('/session')) return blockRefresh ? pending.response : new Response('{"session":null}')
    return new Response(JSON.stringify({ session, user: session.user }))
  })
  const callback = vi.fn()
  const subscription = app.client.auth.onAuthStateChange(callback)
  await vi.waitFor(() => expect(callback).toHaveBeenCalledWith('INITIAL_SESSION', null))
  blockRefresh = true
  app.client.auth.startAutoRefresh()
  await pending.reading
  await app.client.auth.signInWithPassword({ email: 'owner@example.com', password: 'secret' })
  pending.resume()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(callback).toHaveBeenLastCalledWith('SIGNED_IN', session)
  expect(callback.mock.calls.some(([event]) => event === 'SIGNED_OUT')).toBe(false)
  expect((await app.readStoredSession())?.user.id).toBe(session.user.id)
  app.client.auth.stopAutoRefresh()
  subscription.data.subscription.unsubscribe()
})

it('invalidates initial reads started while a login was still pending', async () => {
  const pending = pausedJson({ session: null })
  let finishLogin!: (value: Response) => void
  const app = withFetch(async input => String(input).endsWith('/session') ? pending.response : new Promise<Response>(resolve => { finishLogin = resolve }))
  const login = app.client.auth.signInWithPassword({ email: 'owner@example.com', password: 'secret' })
  await vi.waitFor(() => expect(finishLogin).toBeDefined())
  const callback = vi.fn()
  const subscription = app.client.auth.onAuthStateChange(callback)
  await pending.reading
  finishLogin(new Response(JSON.stringify({ session, user: session.user })))
  expect((await login).error).toBeNull()
  pending.resume()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenLastCalledWith('SIGNED_IN', session)
  subscription.data.subscription.unsubscribe()
})
