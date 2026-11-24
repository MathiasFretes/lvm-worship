import { describe, expect, it, vi } from 'vitest'
import { createLvmBackend } from '@lavozmisionera/core/backend/client'

describe('offline session discovery', () => {
  it('distinguishes a network outage from a confirmed signed-out session', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Network unavailable'))
    const client = createLvmBackend({ url: 'https://lvm.example/api', fetch })
    const listener = vi.fn()
    const { data } = client.auth.onAuthStateChange(listener)
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith('SESSION_UNAVAILABLE', null))
    data.subscription.unsubscribe()
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ session: null }), { status: 200 }))
    const confirmed = vi.fn()
    const next = client.auth.onAuthStateChange(confirmed)
    await vi.waitFor(() => expect(confirmed).toHaveBeenCalledWith('INITIAL_SESSION', null))
    next.data.subscription.unsubscribe()
  })
})
