import { expect, it, vi } from 'vitest'
import { createDeviceTransport } from '../deviceTransport'
const apiUrl = 'https://srv2137598.hstgr.cloud/api'
const session = { access_token: `n_${'a'.repeat(43)}`, expires_at: 2100000000, user: { id: 'account-a' } }
function storage() {
  const values = new Map<string, string>()
  return { values, getItem: async (key: string) => values.get(key) || null, setItem: async (key: string, value: string) => { values.set(key, value) }, removeItem: async (key: string) => { values.delete(key) } }
}
it('keeps opaque device credentials in injected encrypted storage, outside cookies and other origins', async () => {
  const store = storage()
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ session })))
  const client = createDeviceTransport({ apiUrl, storage: store, fetcher })
  await client.fetch(`${apiUrl}/auth/login`, { method: 'POST', headers: { Origin: 'untrusted', Cookie: 'browser' }, body: '{"email":"a@example.com"}' })
  expect(await client.readStoredSession()).toEqual(session)
  await client.fetch(`${apiUrl}/data/songs`)
  const [url, request] = fetcher.mock.calls[1]
  expect(url).toBe(`${apiUrl}/data/songs`)
  expect(request.headers.get('authorization')).toBe(`Bearer ${session.access_token}`)
  expect(request.headers.get('cookie')).toBeNull()
  expect(request.headers.get('origin')).toBeNull()
  expect(request.credentials).toBe('omit')
  expect(request.redirect).toBe('error')
  await expect(client.fetch('https://elsewhere.example/api/data/songs')).rejects.toThrow(/cannot leave/)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('does not resurrect a late sign-in after sign-out', async () => {
  const store = storage()
  let release!: (value: Response) => void
  const fetcher = vi.fn().mockImplementation(async (url: string) => url.endsWith('/login') ? new Promise<Response>(resolve => { release = resolve }) : new Response('{}'))
  const client = createDeviceTransport({ apiUrl, storage: store, fetcher })
  const signingIn = client.fetch(`${apiUrl}/auth/login`, { method: 'POST' })
  await vi.waitFor(() => expect(release).toBeDefined())
  await client.fetch(`${apiUrl}/auth/logout`, { method: 'POST' })
  release(new Response(JSON.stringify({ session })))
  await expect(signingIn).rejects.toThrow(/account changed/)
  expect(await client.readStoredSession()).toBeNull()
})
it('retains an unexpired session during network loss, clears a rejected or expired credential', async () => {
  const store = storage()
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ session }))).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(new Response('{}', { status: 401 }))
  const client = createDeviceTransport({ apiUrl, storage: store, fetcher })
  await client.fetch(`${apiUrl}/auth/login`, { method: 'POST' })
  await expect(client.fetch(`${apiUrl}/auth/session`)).rejects.toThrow('Offline')
  expect(await client.readStoredSession()).toEqual(session)
  await client.fetch(`${apiUrl}/data/users`)
  expect(await client.readStoredSession()).toBeNull()
})
it('merges server session data with the existing device token without exposing it to another API', async () => {
  const store = storage()
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ session }))).mockResolvedValueOnce(new Response(JSON.stringify({ session: { user: { id: 'account-a', memberships: [] } } })))
  const client = createDeviceTransport({ apiUrl, storage: store, fetcher })
  await client.fetch(`${apiUrl}/auth/login`, { method: 'POST' })
  const result = await (await client.fetch(`${apiUrl}/auth/session`)).json()
  expect(result.session.access_token).toBe(session.access_token)
  expect(result.session.user.memberships).toEqual([])
  expect(() => createDeviceTransport({ apiUrl: 'http://example.com/api', storage: store })).toThrow(/HTTPS/)
})
it('expires locally and never merges a different server identity with the saved token', async () => {
  const store = storage()
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ session }))).mockResolvedValueOnce(new Response(JSON.stringify({ session: { user: { id: 'account-b' } } })))
  const client = createDeviceTransport({ apiUrl, storage: store, fetcher })
  await client.fetch(`${apiUrl}/auth/login`, { method: 'POST' })
  await expect(client.fetch(`${apiUrl}/auth/session`)).rejects.toThrow(/identity mismatch/)
  expect(await client.readStoredSession()).toBeNull()
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ session })))
  await client.fetch(`${apiUrl}/auth/login`, { method: 'POST' })
  const expired = createDeviceTransport({ apiUrl, storage: store, fetcher, now: () => session.expires_at * 1000 })
  expect(await expired.readStoredSession()).toBeNull()
})
