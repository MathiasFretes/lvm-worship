import { buildWorshipPlanFromSetlist, parseWorshipContext, toSong } from './worshipPlan.js'
import { draftFromWorshipPlan } from './worshipDraft.js'

export type WorshipScope = { userId: string; churchId: string; serviceId: string; branchId: string }
export type WorshipEntry = {
  id: string
  song: { id: string; title: string; originalKey: string; chordpro_content: string }
  toKey: string | null
}
export type ConnectedWorshipDraft = { context: ReturnType<typeof parseWorshipContext>; entries: WorshipEntry[] }
export type WorshipExchange = {
  context: ReturnType<typeof parseWorshipContext>
  revision: number
  serviceRevision: number
  canPrepare: boolean
  [key: string]: unknown
}
type Operation = { id: string; generation: number; input: { plan: ReturnType<typeof buildWorshipPlanFromSetlist>; revision: number; serviceRevision: number } }
export type ConnectedWorshipState = {
  version: 1
  scope: WorshipScope
  exchange: WorshipExchange | null
  draft: ConnectedWorshipDraft | null
  generation: number
  savedGeneration: number
  localRevision: number
  pending: Operation | null
  conflict: { status: 409; message: string } | null
}
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
type Options = {
  scope: WorshipScope
  storage: Storage
  request(path: string, init: RequestInit): Promise<Response>
  uuid(): string
  isActive(): boolean
}
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const queues = new WeakMap<Storage, Map<string, Promise<unknown>>>()
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const error = (message: string, status?: number) => Object.assign(new Error(message), { status })

export function worshipScope(input: WorshipScope): WorshipScope {
  if (typeof input.userId !== 'string' || !input.userId.trim() || input.userId.length > 200 ||
    !uuidPattern.test(input.churchId) || !uuidPattern.test(input.branchId) ||
    typeof input.serviceId !== 'string' || !input.serviceId.trim() || input.serviceId.length > 200) throw error('Invalid Worship scope')
  return { userId: input.userId, churchId: input.churchId, serviceId: input.serviceId, branchId: input.branchId }
}

/** RN/DOM-free journal. The host supplies account lifecycle and authenticated transport. */
export function createWorshipExchangeRepository(options: Options) {
  const scope = Object.freeze(worshipScope(options.scope))
  const key = `lvm.worship.connected.v1:${JSON.stringify([scope.userId, scope.churchId, scope.serviceId, scope.branchId])}`
  const path = `/api/churches/${scope.churchId}/services/${encodeURIComponent(scope.serviceId)}/worship`
  let disposed = false
  let flight: Promise<ConnectedWorshipState> | null = null
  const controllers = new Set<AbortController>()
  const active = () => { if (disposed || !options.isActive()) throw error('Worship scope is no longer active', 409) }
  const sameContext = (context: ReturnType<typeof parseWorshipContext>) => {
    parseWorshipContext(context)
    if (context.serviceId !== scope.serviceId) throw error('Context belongs to another service')
  }
  function validateDraft(draft: ConnectedWorshipDraft) {
    sameContext(draft.context)
    if (!Array.isArray(draft.entries) || draft.entries.length > 500) throw error('Invalid Worship entries')
    const ids = new Set<string>()
    for (const entry of draft.entries) {
      if (!uuidPattern.test(entry.id) || ids.has(entry.id) || !entry.song?.id || typeof entry.song.title !== 'string') throw error('Invalid Worship occurrence')
      ids.add(entry.id)
      toSong(entry.song, undefined, entry.toKey)
    }
  }
  function validateExchange(value: WorshipExchange): WorshipExchange {
    sameContext(value.context)
    if (!Number.isSafeInteger(value.revision) || value.revision < 0 || !Number.isSafeInteger(value.serviceRevision) || value.serviceRevision < 1 || typeof value.canPrepare !== 'boolean') throw error('Invalid Worship exchange')
    return value
  }
  async function readUnchecked(): Promise<ConnectedWorshipState> {
    const raw = await options.storage.getItem(key)
    if (!raw) return { version: 1, scope, exchange: null, draft: null, generation: 0, savedGeneration: 0, localRevision: 0, pending: null, conflict: null }
    const state = JSON.parse(raw) as ConnectedWorshipState
    if (state.version !== 1 || JSON.stringify(worshipScope(state.scope)) !== JSON.stringify(scope) ||
      !Number.isSafeInteger(state.localRevision) || state.localRevision < 0 || !Number.isSafeInteger(state.generation) || state.generation < 0 || !Number.isSafeInteger(state.savedGeneration) || state.savedGeneration < 0 || state.savedGeneration > state.generation) throw error('Invalid saved Worship journal')
    if (state.exchange) validateExchange(state.exchange)
    if (state.draft) validateDraft(state.draft)
    if (state.pending && (!uuidPattern.test(state.pending.id) || !Number.isSafeInteger(state.pending.generation) || state.pending.generation < 0 || state.pending.generation > state.generation ||
      state.pending.input.plan?.serviceId !== scope.serviceId || !Number.isSafeInteger(state.pending.input.revision) || state.pending.input.revision < 0 ||
      !Number.isSafeInteger(state.pending.input.serviceRevision) || state.pending.input.serviceRevision < 1)) throw error('Invalid saved Worship operation')
    if (state.conflict && (!state.pending || state.conflict.status !== 409)) throw error('Invalid saved Worship conflict')
    return state
  }
  // Multiple mounted repositories sharing native storage cannot race their
  // read/modify/write cycles. Each queued operation remains one atomic record.
  function serial<T>(run: () => Promise<T>): Promise<T> {
    let byKey = queues.get(options.storage)
    if (!byKey) { byKey = new Map(); queues.set(options.storage, byKey) }
    const task = (byKey.get(key) || Promise.resolve()).then(run)
    const settled = task.then(() => undefined, () => undefined)
    byKey.set(key, settled)
    void settled.then(() => { if (byKey?.get(key) === settled) byKey.delete(key) })
    return task
  }
  const read = () => serial(async () => { active(); const state = await readUnchecked(); active(); return clone(state) })
  const change = (update: (state: ConnectedWorshipState) => ConnectedWorshipState) => serial(async () => {
    active()
    const state = await readUnchecked()
    active()
    const next = update(state)
    if (next !== state) {
      next.localRevision = state.localRevision + 1
      await options.storage.setItem(key, JSON.stringify(next))
    }
    active()
    return clone(next)
  })
  async function exchangeRequest(method: 'GET' | 'PUT', operation?: Operation): Promise<WorshipExchange> {
    active()
    const controller = new AbortController()
    controllers.add(controller)
    try {
      const response = await options.request(path, { method, signal: controller.signal, cache: 'no-store', headers: {
        'X-LVM-Account': scope.userId,
        ...(operation ? { 'Content-Type': 'application/json', 'X-LVM-Operation': operation.id } : {}),
      }, body: operation ? JSON.stringify(operation.input) : undefined })
      const body = await response.json()
      active()
      if (!response.ok) throw error(typeof body?.message === 'string' ? body.message : `Worship API ${response.status}`, response.status)
      return validateExchange(body)
    } finally { controllers.delete(controller) }
  }
  async function refresh() {
    const before = await read()
    if (before.pending) throw error('Resolve the pending Worship operation before refreshing', 409)
    const exchange = await exchangeRequest('GET')
    return change(state => {
      if (state.pending) throw error('A Worship operation was queued while refreshing', 409)
      if (state.exchange && (exchange.revision < state.exchange.revision || exchange.serviceRevision < state.exchange.serviceRevision)) return state
      if (state.draft) return { ...state, exchange }
      if (exchange.plan) {
        const restored = draftFromWorshipPlan(exchange.plan, exchange.context)
        const draft = { context: { ...exchange.context, name: restored.name }, entries: restored.entries.map((entry: { sourceSong: WorshipEntry['song']; toKey: string | null }) => ({ id: options.uuid(), song: entry.sourceSong, toKey: entry.toKey })) }
        validateDraft(draft)
        return { ...state, exchange, draft, generation: 1, savedGeneration: 1 }
      }
      return { ...state, exchange, draft: { context: exchange.context, entries: [] } }
    })
  }
  async function edit(update: (draft: ConnectedWorshipDraft) => ConnectedWorshipDraft) {
    return change(state => {
      if (!state.draft || !state.exchange?.canPrepare) throw error('Worship preparation is not available', 403)
      const draft = clone(update(clone(state.draft)))
      validateDraft(draft)
      return { ...state, draft, generation: state.generation + 1 }
    })
  }
  async function queue() {
    return change(state => {
      if (state.pending) throw error('A Worship operation is already pending', 409)
      if (!state.draft || !state.exchange?.canPrepare) throw error('Worship preparation is not available', 403)
      if (state.draft.context.setlistId !== state.exchange.context.setlistId) throw error('The Service setlist changed', 409)
      const id = options.uuid()
      if (!uuidPattern.test(id)) throw error('Invalid Worship operation ID')
      const plan = buildWorshipPlanFromSetlist({ context: state.draft.context,
        songs: state.draft.entries.map(entry => entry.song),
        items: state.draft.entries.map(entry => ({ songId: entry.song.id, sourceSong: entry.song, toKey: entry.toKey })),
      })
      if (JSON.stringify(plan).length > 200000) throw error('Worship proposal is too large')
      return { ...state, pending: { id, generation: state.generation, input: { plan, revision: state.exchange.revision, serviceRevision: state.exchange.serviceRevision } }, conflict: null }
    })
  }
  async function sendPending() {
    const state = await read()
    if (!state.pending) return state
    if (state.conflict) throw error(state.conflict.message, 409)
    const operation = state.pending
    let exchange: WorshipExchange
    try { exchange = await exchangeRequest('PUT', operation) }
    catch (failure) {
      if ((failure as { status?: number }).status === 409) await change(current => current.pending?.id === operation.id
        ? { ...current, conflict: { status: 409, message: (failure as Error).message } } : current)
      throw failure
    }
    if (exchange.revision !== operation.input.revision + 1 || exchange.serviceRevision !== operation.input.serviceRevision || exchange.context.setlistId !== operation.input.plan.setlistId) throw error('Invalid Worship acknowledgement')
    return change(current => current.pending?.id !== operation.id ? current : {
      ...current, exchange, pending: null, conflict: null, savedGeneration: operation.generation,
      // The acknowledgement never replaces the editor's newer local draft.
    })
  }
  const flush = () => {
    if (flight) return flight
    const task = sendPending()
    flight = task
    void task.then(() => { if (flight === task) flight = null }, () => { if (flight === task) flight = null })
    return task
  }
  const cancelPending = () => {
    if (flight) return Promise.reject(error('A Worship request is still running', 409))
    return change(state => ({ ...state, pending: null, conflict: null }))
  }
  return { scope, read, refresh, edit, queue, flush, cancelPending,
    dispose() { disposed = true; controllers.forEach(controller => controller.abort()); controllers.clear() },
  }
}
