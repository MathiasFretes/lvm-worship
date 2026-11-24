import { fireEvent, render, screen } from '@testing-library/react'
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
      { id: 'canto', dbId: 'song-2', title: 'Canto nuevo', language: 'es', tags: [], authors: [], chordpro_content: '[D]Mañana [A]habrá paz', originalKey: 'D' },
    ]
    renderLibrary('/songs?q=nino')
    expect(screen.getByRole('option', { name: /Niño de Belén/ })).toHaveAttribute('href', '/song/nino')
    expect(screen.queryByRole('option', { name: /Canto nuevo/ })).not.toBeInTheDocument()

    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search songs' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search songs' }), 'manana habra paz')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lyrics contain' }))
    expect(screen.getByRole('option', { name: /Canto nuevo/ })).toHaveAttribute('href', '/song/canto')
  })

  test('keeps unpublished personal songs in the library', () => {
    library.personalSongs = [{ id: 'draft-1', slug: 'mi-canto', title: 'Mi canto', status: 'draft', tags: [], artist: '', default_key: 'C' }]
    renderLibrary()
    expect(screen.getByRole('option', { name: /Mi canto/ })).toHaveAttribute('href', '/song/mi-canto?p=draft-1')
  })

  test('combines musical filters with lyric search and resets without losing the search', async () => {
    library.songs = [
      { id: 'slow', title: 'Slow song', language: 'es', originalKey: 'D', tempo: 80, tags: [], chordpro_content: 'peace' },
      { id: 'fast', title: 'Fast song', language: 'es', originalKey: 'D', tempo: 130, tags: [], chordpro_content: 'peace' },
      { id: 'other', title: 'Other key', language: 'es', originalKey: 'G', tempo: 110, tags: [], chordpro_content: 'peace' },
      { id: 'unknown', title: 'Unknown tempo', language: 'es', originalKey: 'D', tempo: null, tags: [], chordpro_content: 'peace' },
    ]
    library.personalSongs = [{ id: 'mine', slug: 'my-song', title: 'Personal arrangement', default_key: 'D', tempo: 110, status: 'draft', tags: [], chordpro_content: 'peace' }]
    renderLibrary('/songs?q=peace')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lyrics contain' }))
    await userEvent.click(screen.getByText('Musical filters'))
    await userEvent.selectOptions(screen.getByLabelText('Key'), 'D')
    fireEvent.change(screen.getByLabelText('Minimum BPM'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Maximum BPM'), { target: { value: '115' } })
    expect(screen.getByRole('option', { name: /Personal arrangement/ })).toBeInTheDocument()
    for (const title of ['Slow song', 'Fast song', 'Other key', 'Unknown tempo']) expect(screen.queryByRole('option', { name: new RegExp(title) })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Song source'), 'catalog')
    expect(screen.queryByRole('option', { name: /Personal arrangement/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Minimum BPM'), { target: { value: '150' } })
    expect(screen.getByRole('alert')).toHaveTextContent('minimum no greater than the maximum')
    await userEvent.click(screen.getByRole('button', { name: 'Reset musical filters' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search songs' })).toHaveValue('peace')
    expect(screen.getByRole('option', { name: /Slow song/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Unknown tempo/ })).toBeInTheDocument()
  })
})
