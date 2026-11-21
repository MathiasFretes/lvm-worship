import { beforeEach, describe, expect, it, vi } from 'vitest'
import { grantOfflineAccess, offlineOwner, reconcileOfflineAccess, subscribeOfflineAccess } from '../offlineAccess'

beforeEach(() => localStorage.clear())

describe('device access to downloaded rehearsals', () => {
  it('retains explicit device access when the session cannot be fetched offline', () => {
    grantOfflineAccess('first')
    reconcileOfflineAccess('SESSION_UNAVAILABLE', null)
    expect(offlineOwner()).toBe('first')
  })
  it.each([
    ['SIGNED_OUT', null],
    ['INITIAL_SESSION', null],
    ['SIGNED_IN', { user: { id: 'second' } }],
  ])('revokes device access on %s', (event, session) => {
    grantOfflineAccess('first')
    const callback = vi.fn()
    const unsubscribe = subscribeOfflineAccess(callback)
    reconcileOfflineAccess(event, session)
    expect(offlineOwner()).toBe('')
    expect(callback).toHaveBeenCalledOnce()
    unsubscribe()
  })
  it('does not grant offline access just because an account signs in', () => {
    reconcileOfflineAccess('SIGNED_IN', { user: { id: 'first' } })
    expect(offlineOwner()).toBe('')
  })
})
