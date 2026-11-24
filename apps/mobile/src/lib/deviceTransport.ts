// RN-free transport. The host must inject encrypted device storage; never use
// AsyncStorage here. This token is opaque and scoped to our own API origin.
export type DeviceCredentials = { access_token: string; expires_at: number; user: { id: string; [key: string]: unknown } }
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> }
type Options = { apiUrl: string; storage: Storage; fetcher?: typeof fetch; now?: () => number }

export function createDeviceTransport({ apiUrl, storage, fetcher = fetch, now = Date.now }: Options) {
  const base = new URL(apiUrl)
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname.replace(/\/$/, '') !== '/api') throw new Error('Device API requires an HTTPS /api URL')
  const key = `lvm.device.session.${base.host.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  let generation = 0
  let writes: Promise<unknown> = Promise.resolve()
  function storedValue(value: DeviceCredentials) {
    const user: DeviceCredentials['user'] = { id: value.user.id }
    for (const field of ['email', 'role']) if (typeof value.user[field] === 'string') user[field] = String(value.user[field]).slice(0, 254)
    const metadata = value.user.user_metadata as { full_name?: unknown } | undefined
    if (typeof metadata?.full_name === 'string') user.user_metadata = { full_name: metadata.full_name.slice(0, 120) }
    // Membership lists can exceed native keychain item limits and are always
    // checked server-side. Persist only a small identity snapshot with the token.
    return JSON.stringify({ access_token: value.access_token, expires_at: value.expires_at, user })
  }
  const write = (action: () => Promise<void>) => {
    const task = writes.then(action)
    writes = task.catch(() => undefined)
    return task
  }
  async function read(): Promise<DeviceCredentials | null> {
    await writes
    const raw = await storage.getItem(key)
    if (!raw) return null
    let value: DeviceCredentials | null = null
    try { value = JSON.parse(raw) as DeviceCredentials } catch { /* Discard an unreadable credential, not a native storage failure. */ }
    if (!value || !/^n_[A-Za-z0-9_-]{43}$/.test(value.access_token) || !value.user?.id || !Number.isSafeInteger(value.expires_at) || value.expires_at * 1000 <= now()) {
      await write(async () => { if (await storage.getItem(key) === raw) await storage.removeItem(key) })
      return null
    }
    return value
  }
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.origin !== base.origin || !url.pathname.startsWith('/api/')) throw new Error('Device credentials cannot leave the API origin')
    const action = url.pathname.startsWith('/api/auth/') ? url.pathname.slice('/api/auth/'.length) : null
    if (action && !['login', 'signup', 'session', 'logout', 'password'].includes(action)) throw new Error('Unsupported device authentication')
    const mutatingSession = action && ['login', 'signup', 'logout', 'password'].includes(action)
    const expectedGeneration = mutatingSession ? ++generation : generation
    const current = await read()
    if (action) url.pathname = `/api/native/auth/${action}`
    const headers = new Headers(init?.headers)
    headers.delete('cookie'); headers.delete('origin'); headers.delete('authorization')
    headers.set('X-LVM-Client', 'native')
    if (current) headers.set('Authorization', `Bearer ${current.access_token}`)
    // Local sign-out must survive a lost connection or a failed server reply.
    // The captured token still revokes the remote session when reachable.
    if (action === 'logout') await write(async () => { if (generation === expectedGeneration) await storage.removeItem(key) })
    const response = await fetcher(url.href, { ...init, headers, credentials: 'omit', redirect: 'error' })
    if (response.url && new URL(response.url).origin !== base.origin) throw new Error('Device API redirect refused')
    if (response.status === 401 && current && expectedGeneration === generation) {
      await write(async () => { if (generation === expectedGeneration) await storage.removeItem(key) })
    }
    if (!action || !response.ok) return response
    const data = await response.clone().json()
    if (generation !== expectedGeneration) throw new Error('Device account changed while authentication was pending')
    if (action === 'logout' || (action === 'session' && !data.session)) {
      await write(async () => { if (generation === expectedGeneration) await storage.removeItem(key) })
    } else if (data.session?.access_token) {
      const value = data.session as DeviceCredentials
      if (!/^n_[A-Za-z0-9_-]{43}$/.test(value.access_token) || !value.user?.id || !Number.isSafeInteger(value.expires_at)) throw new Error('Invalid server device session')
      await write(async () => { if (generation === expectedGeneration) await storage.setItem(key, storedValue(value)) })
    } else if (action === 'session' && data.session && current) {
      if (data.session.user?.id !== current.user.id) {
        await write(async () => { if (generation === expectedGeneration) await storage.removeItem(key) })
        throw new Error('Device session identity mismatch')
      }
      data.session = { ...current, ...data.session }
      await write(async () => { if (generation === expectedGeneration) await storage.setItem(key, storedValue(data.session)) })
      if (generation !== expectedGeneration) throw new Error('Device account changed while authentication was pending')
      return new Response(JSON.stringify(data), { status: response.status, headers: response.headers })
    }
    // Secure storage is asynchronous too. A logout or account replacement can
    // begin while a write is pending, after the earlier response check passed.
    // Never let that old response produce a new auth event in the caller.
    if (generation !== expectedGeneration) throw new Error('Device account changed while authentication was pending')
    // Reads may have started during this mutation, with its starting generation
    // but without its new credential. Committing invalidates those reads too.
    if (mutatingSession) ++generation
    return response
  }
  return { fetch: transport, readStoredSession: read, clearSession: async () => { ++generation; await write(() => storage.removeItem(key)) } }
}
