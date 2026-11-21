import React, { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ConnectedServiceEntry from '../ConnectedServiceEntry'
import { listServiceDrafts, openServiceDraft, serviceScope } from '../serviceDrafts'
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }))
vi.mock('../../../components/layout/PageContainer', () => ({ default: ({ children }) => <main>{children}</main> }))
const props = { userId: 'account-a', churchId: '00000000-0000-4000-8000-000000000011', serviceId: 'service-a' }
const plan = { schemaVersion: '0.1', serviceId: props.serviceId, setlistId: 'set-a', name: 'Música', songs: [] }
const exchange = { context: { serviceId: props.serviceId, name: 'Música' }, revision: 0, serviceRevision: 3, canPrepare: true }
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })
function Child(state) {
  return <><p>{state.exchange?.context.name || 'Loading'}</p><p>{state.error}</p><button disabled={state.busy} onClick={() => state.submit(plan)}>Submit</button><span>{state.pending ? 'Pending' : state.saved ? 'Saved' : 'Ready'}</span></>
}
it('creates one durable branch in Strict Mode and leaves the personal draft alone', async () => {
  localStorage.setItem('lvm.draft.v1', 'personal')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => exchange }))
  render(<StrictMode><ConnectedServiceEntry {...props}>{Child}</ConnectedServiceEntry></StrictMode>)
  await screen.findByText('Música')
  expect(listServiceDrafts(localStorage, serviceScope(props.userId, props.churchId, props.serviceId))).toHaveLength(1)
  expect(localStorage.getItem('lvm.draft.v1')).toBe('personal')
})
it('persists the exact operation before sending and retries its UUID after reconnection', async () => {
  let writes = 0
  const fetcher = vi.fn().mockImplementation(async (_path, input) => {
    if (input.method === 'PUT') {
      writes++
      const branches = listServiceDrafts(localStorage, serviceScope(props.userId, props.churchId, props.serviceId))
      const saved = JSON.parse(localStorage.getItem(`${branches[0].key}:exchange`))
      expect(saved.pending.id).toBe(input.headers['X-LVM-Operation'])
      expect(saved.pending.input).toEqual({ plan, revision: 0, serviceRevision: 3 })
      if (writes === 1) throw new Error('Sin conexión')
      return { ok: true, json: async () => ({ ...exchange, revision: 1, plan }) }
    }
    return { ok: true, json: async () => exchange }
  })
  vi.stubGlobal('fetch', fetcher)
  render(<ConnectedServiceEntry {...props}>{Child}</ConnectedServiceEntry>)
  await screen.findByText('Música')
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
  await screen.findByText('Sin conexión')
  expect(screen.getByText('Pending')).toBeInTheDocument()
  fireEvent(window, new Event('online'))
  await screen.findByText('Saved')
  const requests = fetcher.mock.calls.filter(([, input]) => input.method === 'PUT')
  expect(requests).toHaveLength(2)
  expect(requests[0][1].headers['X-LVM-Operation']).toBe(requests[1][1].headers['X-LVM-Operation'])
})
it('requires an explicit retry after HTTP 409 and retains the pending proposal', async () => {
  const fetcher = vi.fn().mockImplementation(async (_path, input) => input.method === 'PUT' ? { ok: false, status: 409, json: async () => ({ message: 'El culto cambió' }) } : { ok: true, json: async () => exchange })
  vi.stubGlobal('fetch', fetcher)
  render(<ConnectedServiceEntry {...props}>{Child}</ConnectedServiceEntry>)
  await screen.findByText('Música')
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
  await screen.findByText('El culto cambió')
  await waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument())
  expect(fetcher.mock.calls.filter(([, input]) => input.method === 'PUT')).toHaveLength(1)
})

it('resumes a restored operation after Strict Mode cancels its first request', async () => {
  const scope = serviceScope(props.userId, props.churchId, props.serviceId)
  const key = openServiceDraft(localStorage, scope, null, crypto.randomUUID())
  const operationId = crypto.randomUUID()
  localStorage.setItem(`${key}:exchange`, JSON.stringify({ exchange, pending: {
    id: operationId, input: { plan, revision: 0, serviceRevision: 3 },
  } }))
  let writes = 0
  const fetcher = vi.fn().mockImplementation(async (_path, input) => {
    expect(input.headers['X-LVM-Operation']).toBe(operationId)
    if (++writes === 1) return new Promise((resolve, reject) => {
      input.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
    return { ok: true, json: async () => ({ ...exchange, revision: 1, plan }) }
  })
  vi.stubGlobal('fetch', fetcher)
  render(<StrictMode><ConnectedServiceEntry {...props}>{Child}</ConnectedServiceEntry></StrictMode>)
  await screen.findByText('Saved')
  expect(writes).toBe(2)
  expect(screen.queryByText('Aborted')).not.toBeInTheDocument()
})
