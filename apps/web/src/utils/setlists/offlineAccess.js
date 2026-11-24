const KEY = 'lvm.offline-access.v1'
const EVENT = 'lvm:offline-access'

// This permits only reading explicitly downloaded material on this device.
// It is never a server session, role or permission to modify remote data.
export function offlineOwner() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null')
    return value?.version === 1 && typeof value.ownerId === 'string' && value.ownerId.length <= 1024 ? value.ownerId : ''
  } catch { return '' }
}

export function grantOfflineAccess(ownerId) {
  if (!ownerId) throw new Error('A signed-in account is required')
  localStorage.setItem(KEY, JSON.stringify({ version: 1, ownerId }))
  window.dispatchEvent(new Event(EVENT))
}

export function reconcileOfflineAccess(event, session) {
  const owner = offlineOwner()
  if (!owner || event === 'SESSION_UNAVAILABLE') return
  if (event === 'SIGNED_OUT' || !session || session.user?.id !== owner) {
    localStorage.removeItem(KEY)
    window.dispatchEvent(new Event(EVENT))
  }
}

export function subscribeOfflineAccess(callback) {
  const onStorage = event => { if (event.key === KEY || event.key === null) callback() }
  window.addEventListener(EVENT, callback)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener('storage', onStorage)
  }
}
