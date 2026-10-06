import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import WorshipDashboardPage from './WorshipDashboardPage'

const dashboardMock = vi.hoisted(() => ({ load: vi.fn(), signedIn: false }))
vi.mock('../features/dashboard/dashboardRepository', () => ({ loadDashboardSongs: dashboardMock.load }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isLoggedIn: dashboardMock.signedIn }) }))

function SongRoute() {
  const location = useLocation()
  return <p>Library route: {location.search}</p>
}

function renderDashboard() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WorshipDashboardPage />} />
          <Route path="/songs" element={<SongRoute />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )
}

describe('LVM Worship dashboard', () => {
  beforeEach(() => {
    dashboardMock.load.mockReset()
    dashboardMock.signedIn = false
  })

  test('shows loading, then the real catalog count and song routes', async () => {
    let finish
    dashboardMock.load.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderDashboard()
    expect(screen.getByRole('status')).toHaveTextContent('Loading songs')
    finish({ total: 17, songs: [{ id: 'santo', title: 'Santo', artist: 'Equipo LVM', key: 'G' }] })
    expect(await screen.findByRole('link', { name: /Santo/ })).toHaveAttribute('href', '/song/santo')
    expect(screen.getByText('In the library: 17')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Setlists/ })).toHaveAttribute('href', '/setlist')
  })

  test('keeps an empty catalog distinct from a failed request', async () => {
    dashboardMock.load.mockResolvedValue({ total: 0, songs: [] })
    renderDashboard()
    expect(await screen.findByText('No songs are available yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('offers retry after an error and recovers without reloading the page', async () => {
    dashboardMock.load.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ total: 1, songs: [{ id: 'nuevo', title: 'Nuevo canto', artist: '', key: '' }] })
    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveTextContent('Songs could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: /Nuevo canto/ })).toHaveAttribute('href', '/song/nuevo')
    expect(dashboardMock.load).toHaveBeenCalledTimes(2)
  })

  test('searches through the real library route and sends signed-in users to saved setlists', async () => {
    dashboardMock.signedIn = true
    dashboardMock.load.mockResolvedValue({ total: 0, songs: [] })
    renderDashboard()
    expect(screen.getByRole('link', { name: /Setlists/ })).toHaveAttribute('href', '/setlists')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a song' }), '  Santo  ')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.getByText('Library route: ?q=Santo')).toBeInTheDocument())
  })
})
