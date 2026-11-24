import { PostgrestClient } from '@supabase/postgrest-js'

/** Self-hosted data client. Sessions live in an HttpOnly cookie, never localStorage. */
export function createLvmBackend({ url, fetch: fetchImpl = globalThis.fetch }) {
  const base = url.replace(/\/$/, '')
  const listeners = new Set()
  const sessionCodes = new Map()
  const emit = (event, session) => listeners.forEach(callback => callback(event, session))
  async function authRequest(action, input) {
    try {
      const response = await fetchImpl(`${base}/auth/${action}`, {
        credentials: 'include', method: input === undefined ? 'GET' : 'POST',
        headers: input === undefined ? {} : { 'Content-Type': 'application/json' },
        body: input === undefined ? undefined : JSON.stringify(input),
      })
      const data = await response.json()
      return response.ok ? { data, error: null } : { data: {}, error: { message: data.message, status: response.status } }
    } catch (error) { return { data: {}, error: { message: error.message } } }
  }
  const rest = new PostgrestClient(`${base}/data`, { fetch: async (input, options) => {
    const response = await fetchImpl(input, { ...options, credentials: 'include' })
    if (String(input).includes('/data/sessions') && response.ok && options?.method !== 'HEAD') {
      const rows = await response.clone().json().catch(() => null)
      for (const row of Array.isArray(rows) ? rows : rows ? [rows] : []) if (row?.id && row?.code) sessionCodes.set(row.id, row.code)
    }
    return response
  } })
  const auth = {
    supportsOAuth: false,
    async getSession() { return authRequest('session') },
    async getUser() {
      const result = await authRequest('session')
      return { data: { user: result.data?.session?.user || null }, error: result.error }
    },
    onAuthStateChange(callback) {
      listeners.add(callback)
      auth.getSession().then(result => { if (listeners.has(callback)) callback(result.error ? 'SESSION_UNAVAILABLE' : 'INITIAL_SESSION', result.data?.session || null) })
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
    },
    async signInWithPassword(input) {
      const result = await authRequest('login', input)
      if (!result.error) emit('SIGNED_IN', result.data.session)
      return result
    },
    async signUp(input) {
      const result = await authRequest('signup', input)
      if (!result.error) emit('SIGNED_IN', result.data.session)
      return result
    },
    async signOut() {
      const result = await authRequest('logout', {})
      if (!result.error) { sessionCodes.clear(); emit('SIGNED_OUT', null) }
      return result
    },
    async updateUser(input) {
      const result = await authRequest('password', input)
      if (!result.error) emit('SIGNED_IN', result.data.session)
      return result
    },
    async activate(input) {
      const result = await authRequest('activate', input)
      if (!result.error) emit('SIGNED_IN', result.data.session)
      return result
    },
    resetPasswordForEmail: input => authRequest('recover', { email: input }),
    signInWithOAuth: () => Promise.resolve({ data: {}, error: { message: 'External sign-in is not configured' } }),
  }
  return {
    auth, from: table => rest.from(table), rpc: (name, args) => rest.rpc(name, args),
    channel() {
      let timer, callback, config, stopped = false
      const channel = {
        on(_event, nextConfig, nextCallback) { config = nextConfig; callback = nextCallback; return channel },
        subscribe(status) {
          const id = config?.filter?.match(/^id=eq.([\w-]+)$/)?.[1]
          let last = ''
          const poll = async () => {
            if (stopped || !id) return
            const code = sessionCodes.get(id)
            const query = rest.from('sessions').select('*')
            const result = await (code ? query.or(`code.eq.${code},chord_code.eq.${code}`) : query.eq('id', id)).maybeSingle()
            if (stopped) return
            if (result.error) status?.('CHANNEL_ERROR')
            else {
              status?.('SUBSCRIBED')
              const serialized = JSON.stringify(result.data)
              if (result.data && serialized !== last) { last = serialized; callback?.({ new: result.data }) }
            }
            timer = setTimeout(poll, 1200)
          }
          poll()
          return channel
        },
        unsubscribe() { stopped = true; clearTimeout(timer) },
      }
      return channel
    },
    removeChannel(channel) { channel.unsubscribe() },
  }
}
