import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { AuthProvider, useAuth } from '../useAuth'

const { authListener, unsubscribe } = vi.hoisted(() => ({
  authListener: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        authListener.mockImplementation(callback)
        return { data: { subscription: { unsubscribe } } }
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }
}))

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

describe('LVM authentication state contract', () => {
  it('keeps protected worship routes pending until Supabase reports a session', () => {
    const { result } = renderHook(useAuth, { wrapper })

    expect(result.current).toMatchObject({ loading: true, isLoggedIn: false })
  })

  it.each([
    ['a visitor', null, false],
    ['a worship-team member', { user: { id: 'lvm-musician' } }, true],
  ])('resolves %s from INITIAL_SESSION', async (_scenario, session, loggedIn) => {
    const { result } = renderHook(useAuth, { wrapper })
    await act(async () => authListener('INITIAL_SESSION', session))

    expect(result.current.loading).toBe(false)
    expect(result.current.isLoggedIn).toBe(loggedIn)
    expect(result.current.session).toBe(session)
  })
})
