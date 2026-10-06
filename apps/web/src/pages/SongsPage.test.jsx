import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import SongsPage from './SongsPage'

const library = vi.hoisted(() => ({ songs: [], loading: false, error: null, retry: vi.fn(), personalSongs: [] }))
vi.mock('../hooks/useSongs', () => ({ useSongs: () => library }))
vi.mock('../hooks/usePersonalSongs', () => ({ usePersonalSongs: () => ({ personalSongs: library.personalSongs, loading: false }) }))

function renderLibrary(path = '/songs') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <SongsPage />
      </MemoryRouter>
    </HelmetProvider>,
  )
}

beforeEach(() => {
  library.songs = []
  library.loading = false
  library.error = null
  library.personalSongs = []
  library.retry.mockReset()
})

describe('LVM song library', () => {
  test('separates loading, empty and failed catalog states', async () => {
    library.loading = true
    const view = renderLibrary()
    expect(screen.getByRole('status')).toHaveTextContent('Loading songs')

    library.loading = false
    view.rerender(<HelmetProvider><MemoryRouter><SongsPage /></MemoryRouter></HelmetProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('No songs are available yet')

    library.error = new Error('offline')
    view.rerender(<HelmetProvider><MemoryRouter><SongsPage /></MemoryRouter></HelmetProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent('Songs could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(library.retry).toHaveBeenCalledOnce()
  })

  test('finds accented titles and lyrics, and opens the song route', async () => {
    library.songs = [
      { id: 'nino', dbId: 'song-1', title: 'Niño de Belén', language: 'es', tags: ['Navidad'], authors: ['José'], chordpro_content: 'Dios de amor', originalKey: 'G' },
      { id: 'canto', dbId: 'song-2', title: 'Canto nuevo', language: 'es', tags: [], authors: [], chordpro_content: 'Mañana habrá paz', originalKey: 'D' },
    ]
    renderLibrary('/songs?q=nino')
    expect(screen.getByRole('option', { name: /Niño de Belén/ })).toHaveAttribute('href', '/song/nino')
    expect(screen.queryByRole('option', { name: /Canto nuevo/ })).not.toBeInTheDocument()

    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search songs' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search songs' }), 'manana')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lyrics contain' }))
    expect(screen.getByRole('option', { name: /Canto nuevo/ })).toHaveAttribute('href', '/song/canto')
  })

  test('keeps unpublished personal songs in the library', () => {
    library.personalSongs = [{ id: 'draft-1', slug: 'mi-canto', title: 'Mi canto', status: 'draft', tags: [], artist: '', default_key: 'C' }]
    renderLibrary()
    expect(screen.getByRole('option', { name: /Mi canto/ })).toHaveAttribute('href', '/song/mi-canto?p=draft-1')
  })
})
