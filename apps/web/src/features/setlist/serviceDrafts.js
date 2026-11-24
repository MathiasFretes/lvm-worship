const PREFIX = 'lvm.worship.service-draft.v1:'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
export function sameServicePlan(left, right) {
  const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value
  return !!left && !!right && JSON.stringify(ordered(left)) === JSON.stringify(ordered(right))
}
export function serviceScope(userId, churchId, serviceId) {
  if (!userId || !uuid.test(churchId || '') || typeof serviceId !== 'string' || !serviceId.trim() || serviceId.length > 200) throw new Error('Invalid service scope')
  return { userId, churchId, serviceId, prefix: `${PREFIX}${JSON.stringify([userId, churchId, serviceId])}:` }
}
export function listServiceDrafts(storage, scope) {
  const drafts = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (!key?.startsWith(scope.prefix) || key.endsWith(':exchange')) continue
    try {
      const draft = JSON.parse(storage.getItem(key))
      if (draft && typeof draft.name === 'string' && Array.isArray(draft.entries)) drafts.push({ key, draft })
    } catch { /* A corrupt branch must not hide the other recoverable copies. */ }
  }
  return drafts
}
export function openServiceDraft(storage, scope, previousKey, branchId) {
  if (!uuid.test(branchId || '')) throw new Error('Invalid draft branch')
  if (previousKey && !previousKey.startsWith(scope.prefix)) throw new Error('Draft belongs to another scope')
  const key = `${scope.prefix}${branchId}`
  if (storage.getItem(key) !== null) throw new Error('Draft branch already exists')
  const initial = previousKey ? storage.getItem(previousKey) : null
  storage.setItem(key, initial || JSON.stringify({ name: '', serviceDate: null, entries: [] }))
  if (previousKey) {
    const metadata = storage.getItem(`${previousKey}:exchange`)
    if (metadata) storage.setItem(`${key}:exchange`, metadata)
  }
  return key
}
export async function exchangeRequest(scope, { method = 'GET', input, operationId, signal, fetcher = globalThis.fetch } = {}) {
  const response = await fetcher(`/api/churches/${scope.churchId}/services/${encodeURIComponent(scope.serviceId)}/worship`, {
    method, credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'X-LVM-Account': scope.userId, ...(input ? { 'Content-Type': 'application/json', 'X-LVM-Operation': operationId } : {}) },
    body: input ? JSON.stringify(input) : undefined,
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.message || `Service API ${response.status}`), { status: response.status })
  return result
}
