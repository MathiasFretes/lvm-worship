import { createLvmBackend } from '@lavozmisionera/core/backend/client.js'
import { createDeviceTransport } from './deviceTransport'

export function createDeviceBackend(options: Parameters<typeof createDeviceTransport>[0]) {
  const transport = createDeviceTransport(options)
  const client = createLvmBackend({ url: options.apiUrl, fetch: transport.fetch })
  const originalGet = client.auth.getSession.bind(client.auth)
  const originalSignOut = client.auth.signOut.bind(client.auth)
  const listeners = new Set<(event: string, session: unknown) => void>()
  let timer: ReturnType<typeof setInterval> | undefined
  const emit = (event: string, session: unknown) => listeners.forEach(callback => callback(event, session))
  client.auth.getSession = async () => {
    const result = await originalGet()
    if (result.error) {
      // Only an unexpired secure local credential can support offline boot.
      const session = await transport.readStoredSession().catch(() => null)
      return { ...result, data: { ...result.data, session } }
    }
    return result
  }
  const originalSubscribe = client.auth.onAuthStateChange.bind(client.auth)
  client.auth.onAuthStateChange = callback => {
    listeners.add(callback)
    const subscription = originalSubscribe(callback)
    return { data: { subscription: { unsubscribe() { listeners.delete(callback); return subscription.data.subscription.unsubscribe() } } } }
  }
  client.auth.signOut = async (options?: { scope?: string }) => {
    if (options?.scope === 'others') return { data: {}, error: { message: 'Standalone revocation of other devices is not supported', status: 400 } }
    if (options?.scope === 'local') {
      await transport.clearSession()
      emit('SIGNED_OUT', null)
      return { data: {}, error: null }
    }
    const result = await originalSignOut()
    if (result.error && !(await transport.readStoredSession())) emit('SIGNED_OUT', null)
    return result
  }
  async function refresh() {
    const result = await client.auth.getSession()
    if (!result.error) emit(result.data.session ? 'TOKEN_REFRESHED' : 'SIGNED_OUT', result.data.session)
  }
  return {
    client: { ...client, auth: { ...client.auth,
      passwordChangeRevokesSessions: true,
      startAutoRefresh() { if (!timer) { void refresh(); timer = setInterval(() => { void refresh() }, 60000) } },
      stopAutoRefresh() { if (timer) clearInterval(timer); timer = undefined },
    } },
    readStoredSession: transport.readStoredSession,
    fetch: transport.fetch,
  }
}
