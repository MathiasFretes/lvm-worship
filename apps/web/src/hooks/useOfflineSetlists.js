import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { offlineOwner, subscribeOfflineAccess } from '../utils/setlists/offlineAccess'
import { createBrowserOfflineSetlists } from '../utils/setlists/offlineStorage'

export const offlineSetlists = createBrowserOfflineSetlists()
const CHANGED = 'lvm:offline-setlists'
export const notifyOfflineSetlists = () => window.dispatchEvent(new Event(CHANGED))

export function useOfflineSetlists() {
  const ownerId = useSyncExternalStore(subscribeOfflineAccess, offlineOwner, () => '')
  const [state, setState] = useState({ ownerId: '', setlists: [], error: null })
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    window.addEventListener(CHANGED, refresh)
    return () => window.removeEventListener(CHANGED, refresh)
  }, [refresh])
  useEffect(() => {
    let cancelled = false
    const load = ownerId ? offlineSetlists.read(ownerId) : Promise.resolve([])
    load.then(setlists => {
      if (!cancelled) setState({ ownerId, setlists, error: null })
    }).catch(error => {
      if (!cancelled) setState({ ownerId, setlists: [], error })
    })
    return () => { cancelled = true }
  }, [ownerId, revision])
  // Hide the previous account synchronously, before the async read resolves.
  return state.ownerId === ownerId ? { ...state, refresh } : { ownerId, setlists: [], error: null, refresh }
}
