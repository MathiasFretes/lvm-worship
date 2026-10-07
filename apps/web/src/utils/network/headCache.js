// src/utils/network/headCache.js
// Cache in-flight requests as well as results so concurrent callers share one
// network operation.
const headCache = new Map()

export async function headOk(url, key) {
  const k = key || url
  if (headCache.has(k)) return headCache.get(k)
  const request = fetch(url, { method: 'HEAD' })
    .then((res) => res.ok)
    .catch(() => {
      // Network failures are transient; report false to this caller but allow
      // the next invocation to retry.
      headCache.delete(k)
      return false
    })
  headCache.set(k, request)
  const result = await request
  if (headCache.get(k) === request) headCache.set(k, result)
  return result
}

export function clearHeadCache(key) {
  if (typeof key === 'undefined') headCache.clear()
  else headCache.delete(key)
}

export default { headOk, clearHeadCache }
