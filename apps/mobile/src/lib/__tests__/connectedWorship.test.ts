import { expect, it, vi } from 'vitest'
import { createWorshipExchangeRepository, type ConnectedWorshipDraft } from '@lavozmisionera/core/setlists/worshipExchange'

const churchId = '00000000-0000-4000-8000-000000000011'
const branchId = '00000000-0000-4000-8000-000000000012'
const entryId = '00000000-0000-4000-8000-000000000013'
const otherId = '00000000-0000-4000-8000-000000000014'
const scope = { userId: 'musician', churchId, serviceId: 'culto/uno', branchId }
const context = { schemaVersion: '0.1' as const, serviceId: scope.serviceId, title: 'Culto', startsAt: '2026-11-22T20:00:00-03:00', setlistId: 'set-1', name: 'Ensayo' }
const exchange = { context, revision: 0, serviceRevision: 1, canPrepare: true, plan: null }
const song = { id: 'alba', title: 'Alba', originalKey: 'D', chordpro_content: '{key:D}\n[D]Sale el sol 😀 [A]hoy' }
const add = (draft: ConnectedWorshipDraft): ConnectedWorshipDraft => ({ ...draft, entries: [...draft.entries, { id: draft.entries.length ? otherId : entryId, song, toKey: draft.entries.length ? 'G' : 'E' }] })
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function setup() {
  const values = new Map<string, string>()
  let active = true
  let offline = false
  let writeError = false
  let sequence = 100
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { if (writeError) throw new Error('Storage full'); values.set(key, value) },
  }
  const request = vi.fn<typeof fetch>().mockImplementation(async (_path, init) => {
    if (offline) throw new Error('Offline')
    if (init?.method === 'PUT') {
      const persisted = JSON.parse([...values.values()][0])
      expect(persisted.pending.id).toBe(new Headers(init.headers).get('X-LVM-Operation'))
      return response({ ...exchange, revision: 1, plan: JSON.parse(String(init.body)).plan })
    }
    return response(exchange)
  })
  const options = { scope, storage, request: (path: string, init: RequestInit) => request(path, init), uuid: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`, isActive: () => active }
  const open = (nextScope = scope) => createWorshipExchangeRepository({ ...options, scope: nextScope })
  return { open, request, values, storage, disconnect: () => { offline = true }, reconnect: () => { offline = false }, switchAccount: () => { active = false }, failStorage: () => { writeError = true } }
}

it('recovers the exact durable operation after offline restart and scopes its native request', async () => {
  const app = setup()
  const repo = app.open()
  await repo.refresh()
  await repo.edit(add)
  const queued = await repo.queue()
  app.disconnect()
  await expect(repo.flush()).rejects.toThrow('Offline')
  repo.dispose()
  app.reconnect()
  const restored = app.open()
  expect((await restored.read()).pending).toEqual(queued.pending)
  const saved = await restored.flush()
  expect(saved.pending).toBeNull()
  expect(saved.savedGeneration).toBe(saved.generation)
  const [path, init] = app.request.mock.calls.at(-1)!
  expect(path).toBe(`/api/churches/${churchId}/services/culto%2Funo/worship`)
  expect(new Headers(init?.headers).get('X-LVM-Account')).toBe(scope.userId)
  expect(new Headers(init?.headers).get('X-LVM-Operation')).toBe(queued.pending!.id)
  expect(saved.draft!.entries[0].toKey).toBe('E')
})

it('keeps newer local edits while an earlier proposal is in flight and sends each occurrence', async () => {
  const app = setup()
  const repo = app.open()
  await repo.refresh()
  await repo.edit(add)
  const queued = await repo.queue()
  let finish!: (value: Response) => void
  app.request.mockImplementationOnce(async () => new Promise<Response>(resolve => { finish = resolve }))
  const sending = repo.flush()
  expect(repo.flush()).toBe(sending)
  await vi.waitFor(() => expect(finish).toBeDefined())
  await repo.edit(add)
  finish(response({ ...exchange, revision: 1, plan: queued.pending!.input.plan }))
  const acknowledged = await sending
  expect(acknowledged.draft!.entries).toHaveLength(2)
  expect(acknowledged.savedGeneration).toBe(1)
  expect(acknowledged.generation).toBe(2)
  const next = await repo.queue()
  expect(next.pending!.id).not.toBe(queued.pending!.id)
  expect(next.pending!.input.revision).toBe(1)
  expect(next.pending!.input.plan.songs.map((item: { key: string }) => item.key)).toEqual(['E', 'G'])
})

it('persists a 409 until explicit resolution, preserving the local draft through cancellation and refresh', async () => {
  const app = setup()
  const repo = app.open()
  await repo.refresh()
  await repo.edit(add)
  const queued = await repo.queue()
  app.request.mockResolvedValueOnce(response({ message: 'El culto cambió' }, 409))
  await expect(repo.flush()).rejects.toMatchObject({ status: 409 })
  const reopened = app.open()
  expect((await reopened.read()).pending).toEqual(queued.pending)
  const calls = app.request.mock.calls.length
  await expect(reopened.flush()).rejects.toMatchObject({ status: 409 })
  await expect(reopened.refresh()).rejects.toMatchObject({ status: 409 })
  expect(app.request).toHaveBeenCalledTimes(calls)
  const resolved = await reopened.cancelPending()
  expect(resolved.draft!.entries).toHaveLength(1)
  app.request.mockResolvedValueOnce(response({ ...exchange, revision: 2, serviceRevision: 3 }))
  await reopened.refresh()
  const retried = await reopened.queue()
  expect(retried.pending!.input.revision).toBe(2)
  expect(retried.pending!.input.serviceRevision).toBe(3)
  expect(retried.pending!.id).not.toBe(queued.pending!.id)
})

it('keeps accounts, churches, services and branches apart, without replacing file drafts', async () => {
  const app = setup()
  app.values.set('lvm.worship.service-draft.v1.musician', 'previous file draft')
  const repo = app.open()
  await repo.refresh()
  await repo.edit(add)
  for (const next of [{ ...scope, userId: 'other' }, { ...scope, churchId: otherId }, { ...scope, serviceId: 'other' }, { ...scope, branchId: otherId }]) {
    const state = await app.open(next).read()
    expect(state.draft).toBeNull()
    expect(state.pending).toBeNull()
  }
  expect(app.values.get('lvm.worship.service-draft.v1.musician')).toBe('previous file draft')
})

it('does not acknowledge old account responses, and disposal aborts its scoped request', async () => {
  const app = setup()
  const repo = app.open()
  await repo.refresh()
  await repo.edit(add)
  const queued = await repo.queue()
  let finish!: (value: Response) => void
  let signal: AbortSignal | null | undefined
  app.request.mockImplementationOnce(async (_path, init) => { signal = init?.signal; return new Promise<Response>(resolve => { finish = resolve }) })
  const sending = repo.flush()
  const failure = sending.catch(error => error)
  await vi.waitFor(() => expect(finish).toBeDefined())
  app.switchAccount()
  repo.dispose()
  expect(signal?.aborted).toBe(true)
  finish(response({ ...exchange, revision: 1 }))
  expect(await failure).toMatchObject({ status: 409 })
  await expect(repo.read()).rejects.toThrow('no longer active')
  expect(JSON.parse([...app.values.values()][0]).pending).toEqual(queued.pending)
})

it('does not send a proposal whose journal could not be persisted', async () => {
  const app = setup()
  const repo = app.open()
  await repo.refresh()
  await repo.edit(add)
  app.failStorage()
  await expect(repo.queue()).rejects.toThrow('Storage full')
  expect((await repo.flush()).pending).toBeNull()
  expect(app.request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0)
})

it('serializes edits across repository instances and preserves pending work after permission revocation', async () => {
  const app = setup()
  const first = app.open()
  const second = app.open()
  await first.refresh()
  await Promise.all([first.edit(add), second.edit(add)])
  expect((await first.read()).draft!.entries).toHaveLength(2)
  const queued = await first.queue()
  app.request.mockResolvedValueOnce(response({ message: 'Forbidden' }, 403))
  await expect(first.flush()).rejects.toMatchObject({ status: 403 })
  expect((await second.read()).pending).toEqual(queued.pending)
  expect((await second.read()).draft!.entries).toHaveLength(2)
})

it('refuses read-only preparation and mismatched or corrupt contexts', async () => {
  const app = setup()
  const repo = app.open()
  app.request.mockResolvedValueOnce(response({ ...exchange, canPrepare: false }))
  await repo.refresh()
  await expect(repo.edit(add)).rejects.toMatchObject({ status: 403 })
  await expect(repo.queue()).rejects.toMatchObject({ status: 403 })
  app.request.mockResolvedValueOnce(response({ ...exchange, context: { ...context, serviceId: 'another' } }))
  await expect(repo.refresh()).rejects.toThrow('another service')
  const key = [...app.values.keys()][0]
  app.values.set(key, '{broken')
  await expect(repo.read()).rejects.toThrow()
  expect(app.values.get(key)).toBe('{broken')
})

it('does not downgrade the context when refresh responses arrive in reverse order', async () => {
  const app = setup()
  const repo = app.open()
  await repo.refresh()
  let finish!: (value: Response) => void
  app.request.mockImplementationOnce(async () => new Promise<Response>(resolve => { finish = resolve }))
  const older = repo.refresh()
  await vi.waitFor(() => expect(finish).toBeDefined())
  app.request.mockResolvedValueOnce(response({ ...exchange, revision: 2, serviceRevision: 3 }))
  await repo.refresh()
  finish(response({ ...exchange, revision: 1, serviceRevision: 2 }))
  const state = await older
  expect(state.exchange!.revision).toBe(2)
  expect(state.exchange!.serviceRevision).toBe(3)
})

it('keeps the operation when a successful HTTP reply acknowledges another revision', async () => {
  const app = setup()
  const repo = app.open()
  await repo.refresh()
  await repo.edit(add)
  const queued = await repo.queue()
  app.request.mockResolvedValueOnce(response({ ...exchange, revision: 9 }))
  await expect(repo.flush()).rejects.toThrow('Invalid Worship acknowledgement')
  expect((await repo.read()).pending).toEqual(queued.pending)
})

it('restores the server musical snapshot with repeated occurrences instead of starting an empty replacement', async () => {
  const source = setup()
  const prepared = source.open()
  await prepared.refresh()
  await prepared.edit(add)
  await prepared.edit(add)
  const plan = (await prepared.queue()).pending!.input.plan
  const target = setup()
  const repo = target.open()
  target.request.mockResolvedValueOnce(response({ ...exchange, revision: 1, plan }))
  const restored = await repo.refresh()
  expect(restored.draft!.entries.map(entry => entry.toKey)).toEqual(['E', 'G'])
  expect(new Set(restored.draft!.entries.map(entry => entry.id)).size).toBe(2)
  expect(restored.generation).toBe(restored.savedGeneration)
  const queued = await repo.queue()
  expect(queued.pending!.input.plan).toEqual(plan)
})
