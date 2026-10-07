import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WorshipNavigation from './WorshipNavigation'

const authState = vi.hoisted(() => ({ current: null }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState.current || {
    isLoggedIn: false,
    loading: false,
    session: null,
    profile: null,
    hasMinRole: () => false,
  },
}))

function renderNavigation(path) {
  return render(<MemoryRouter initialEntries={[path]}><WorshipNavigation /></MemoryRouter>)
}

describe('LVM Worship navigation', () => {
  afterEach(() => { authState.current = null })

  test('keeps the main destinations and marks a saved setlist active', () => {
    renderNavigation('/setlists/culto-1')
    const desktop = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(desktop).getByRole('link', { name: 'Setlist' })).toHaveAttribute('href', '/setlist')
    expect(within(desktop).getByRole('link', { name: 'Setlist' })).toHaveAttribute('aria-current', 'page')
    for (const destination of ['Home', 'Songs', 'Songbook', 'Daily Word']) {
      expect(within(desktop).getByRole('link', { name: destination })).toBeInTheDocument()
    }
    expect(within(desktop).queryByRole('link', { name: 'Blog' })).not.toBeInTheDocument()
  })

  test('opens the mobile drawer and restores focus and scroll on Escape', async () => {
    renderNavigation('/songs')
    const trigger = screen.getByRole('button', { name: 'Open main menu' })
    trigger.focus()
    fireEvent.click(trigger)
    const drawer = screen.getByRole('dialog', { name: 'Mobile menu' })
    expect(within(drawer).getByRole('link', { name: 'Songs' })).toHaveAttribute('aria-current', 'page')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(drawer).not.toBeInTheDocument())
    expect(document.body.style.overflow).toBe('')
    expect(trigger).toHaveFocus()
  })

  test('sends an editor to saved setlists and preserves role-gated access', () => {
    authState.current = {
      isLoggedIn: true,
      loading: false,
      session: { user: { email: 'editor@example.test' } },
      profile: { display_name: 'Editor' },
      hasMinRole: role => role === 'user' || role === 'editor',
    }
    renderNavigation('/editor')
    const desktop = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(desktop).getByRole('link', { name: 'Setlist' })).toHaveAttribute('href', '/setlists')
    expect(within(desktop).getByRole('link', { name: 'Editor Portal' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'User menu' }))
    expect(screen.getByRole('link', { name: 'Song Editor' })).toHaveAttribute('href', '/portal/editor')
    expect(screen.queryByRole('link', { name: 'Post Editor' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin Portal' })).not.toBeInTheDocument()
  })
})
