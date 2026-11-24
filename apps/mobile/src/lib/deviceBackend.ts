import { createLvmBackend } from '@lavozmisionera/core/backend/client.js'
import { createDeviceTransport } from './deviceTransport'

export function createDeviceBackend(options: Parameters<typeof createDeviceTransport>[0]) {
  const transport = createDeviceTransport(options)
  const client = createLvmBackend({ url: options.apiUrl, fetch: transport.fetch })
  const originalGet = client.auth.getSession.bind(client.auth)
  const originalSignOut = client.auth.signOut.bind(client.auth)
  const listeners = new Set<(event: string, session: unknown) => void>()
  // Transport protects stored credentials; this generation also protects the
  // async JSON decoding and auth notifications that happen after fetch returns.
  let accountGeneration = 0
  let timer: ReturnType<typeof setInterval> | undefined
  const emit = (event: string, session: unknown) => listeners.forEach(callback => callback(event, session))
  const changed = () => ({ data: { session: null, user: null }, error: { message: 'Device account changed while authentication was pending', status: 409 } })
  client.auth.getSession = async () => {
    const expected = accountGeneration
    const result = await originalGet()
    if (expected !== accountGeneration) return changed()
    if (result.error) {
      // Only an unexpired secure local credential can support offline boot.
      const session = await transport.readStoredSession().catch(() => null)
      if (expected !== accountGeneration) return changed()
      return { ...result, data: { ...result.data, session } }
    }
    return result
  }
  client.auth.getUser = async () => {
    const result = await client.auth.getSession()
    return { data: { user: result.data.session?.user || null }, error: result.error }
  }
  // Do not forward the core client's ungated events. All device notifications
  // pass through this adapter, including the asynchronous initial subscription.
  client.auth.onAuthStateChange = callback => {
    listeners.add(callback)
    const expected = accountGeneration
    void client.auth.getSession().then(result => {
      if (expected === accountGeneration && listeners.has(callback)) callback(result.error ? 'SESSION_UNAVAILABLE' : 'INITIAL_SESSION', result.data.session || null)
    })
    return { data: { subscription: { unsubscribe() { return listeners.delete(callback) } } } }
  }
  function sessionMutation<T>(run: (input: T) => ReturnType<typeof client.auth.signInWithPassword>) {
    return async (input: T) => {
      const expected = ++accountGeneration
      const result = await run(input)
      if (expected !== accountGeneration) return changed()
      if (!result.error) { ++accountGeneration; emit('SIGNED_IN', result.data.session) }
      return result
    }
  }
  client.auth.signInWithPassword = sessionMutation(client.auth.signInWithPassword.bind(client.auth))
  client.auth.signUp = sessionMutation(client.auth.signUp.bind(client.auth))
  client.auth.updateUser = sessionMutation(client.auth.updateUser.bind(client.auth))
  const signOut = async (options?: { scope?: string }) => {
    if (options?.scope === 'others') return { data: {}, error: { message: 'Standalone revocation of other devices is not supported', status: 400 } }
    const expected = ++accountGeneration
    if (options?.scope === 'local') {
      await transport.clearSession()
      if (expected !== accountGeneration) return changed()
      ++accountGeneration
      emit('SIGNED_OUT', null)
      return { data: {}, error: null }
    }
    const result = await originalSignOut()
    if (expected !== accountGeneration) return changed()
    const remaining = await transport.readStoredSession()
    if (expected !== accountGeneration) return changed()
    if (!result.error || !remaining) { ++accountGeneration; emit('SIGNED_OUT', null) }
    return result
  }
  client.auth.signOut = signOut
  async function refresh() {
    const expected = accountGeneration
    const result = await client.auth.getSession()
    if (expected === accountGeneration && !result.error) emit(result.data.session ? 'TOKEN_REFRESHED' : 'SIGNED_OUT', result.data.session)
  }
  return {
    client: { ...client, auth: { ...client.auth,
      signOut,
      passwordChangeRevokesSessions: true,
      startAutoRefresh() { if (!timer) { void refresh(); timer = setInterval(() => { void refresh() }, 60000) } },
      stopAutoRefresh() { if (timer) clearInterval(timer); timer = undefined },
    } },
    readStoredSession: transport.readStoredSession,
    fetch: transport.fetch,
  }
}
