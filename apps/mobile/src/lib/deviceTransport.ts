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
  const write = (action: () => Promise<void>) => {
    const task = writes.then(action)
    writes = task.catch(() => undefined)
    return task
  }
  async function read(): Promise<DeviceCredentials | null> {
    await writes
    const raw = await storage.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw) as DeviceCredentials
    if (!/^n_[A-Za-z0-9_-]{43}$/.test(value.access_token) || !value.user?.id || !Number.isSafeInteger(value.expires_at)) throw new Error('Invalid device session')
    if (value.expires_at * 1000 <= now()) {
      await write(() => storage.removeItem(key))
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
      await write(async () => { if (generation === expectedGeneration) await storage.setItem(key, JSON.stringify(value)) })
    } else if (action === 'session' && data.session && current) {
      if (data.session.user?.id !== current.user.id) {
        await write(async () => { if (generation === expectedGeneration) await storage.removeItem(key) })
        throw new Error('Device session identity mismatch')
      }
      data.session = { ...current, ...data.session }
      await write(async () => { if (generation === expectedGeneration) await storage.setItem(key, JSON.stringify(data.session)) })
      return new Response(JSON.stringify(data), { status: response.status, headers: response.headers })
    }
    return response
  }
  return { fetch: transport, readStoredSession: read }
}
