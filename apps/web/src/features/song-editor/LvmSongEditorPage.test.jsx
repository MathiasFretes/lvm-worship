import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LvmSongEditorPage from './LvmSongEditorPage'
import { songFormFromRow } from './songEditorModel'

const context = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), songs: [], role: 'editor' }))
vi.mock('./songEditorRepository', () => ({ loadEditableSong: context.load, saveEditableSong: context.save }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'user-1' } }, role: context.role, hasMinRole: () => true }) }))
vi.mock('../../hooks/useRole', () => ({ useRole: () => ({ role: context.role, isAtLeast: role => role === 'editor' }) }))
vi.mock('../../hooks/useSongs', () => ({ useSongs: () => ({ songs: context.songs, loading: false, error: null }) }))
vi.mock('./PptxAttachment', () => ({ PptxAttachment: () => <p>PPTX attachment</p> }))
vi.mock('../../components/editor/SuggestionReviewPanel', () => ({ default: () => null }))
vi.mock('../../components/editor/ChordProGuideDrawer', () => ({ default: () => null }))
vi.mock('../../components/editor/LivePreviewModal', () => ({ default: () => null }))

function renderEditor(path = '/portal/editor') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portal/editor" element={<LvmSongEditorPage />} />
          <Route path="/portal/editor/:slug" element={<LvmSongEditorPage />} />
          <Route path="/songs" element={<p>Song library</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )
}

beforeEach(() => {
  context.load.mockReset()
  context.save.mockReset()
  context.songs = []
  context.role = 'editor'
  context.load.mockResolvedValue({ kind: 'new', row: null, form: songFormFromRow() })
})

describe('LVM song editor', () => {
  it('validates before saving and sends the complete ChordPro form to the repository', async () => {
    renderEditor()
    await screen.findByRole('heading', { name: 'New song' })
    await userEvent.click(screen.getByRole('button', { name: 'Save song' }))
    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(context.save).not.toHaveBeenCalled()

    await userEvent.type(screen.getByRole('textbox', { name: /^Title/ }), 'Niño de Belén')
    await userEvent.type(screen.getByLabelText('Artist / author'), 'Equipo LVM')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^Key/ }), 'G')
    await userEvent.type(screen.getByRole('textbox', { name: /^Tags/ }), 'Navidad')
    fireEvent.change(screen.getByLabelText('ChordPro song body'), { target: { value: '{start_of_verse: Verse 1}\n[G]Gloria\n{end_of_verse}' } })
    context.save.mockImplementation(async (_, { form }) => ({ kind: 'published', row: { id: 'uuid-1', slug: 'nino_de_belen', ...form }, form }))
    await userEvent.click(screen.getByRole('button', { name: 'Save song' }))
    await waitFor(() => expect(context.save).toHaveBeenCalledOnce())
    expect(context.save.mock.calls[0][1].form).toMatchObject({ title: 'Niño de Belén', artist: 'Equipo LVM', default_key: 'G', tags: ['Navidad'] })
  })

  it('loads an existing song and protects edits on cancel', async () => {
    const row = { id: 'uuid-2', slug: 'santo', title: 'Santo', default_key: 'D', tags: ['Adoración'], chordpro_content: '{start_of_chorus}\n[D]Santo\n{end_of_chorus}' }
    context.load.mockResolvedValue({ kind: 'published', row, form: songFormFromRow(row) })
    renderEditor('/portal/editor/santo')
    expect(await screen.findByDisplayValue('Santo')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Title *'), ' Dios')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByDisplayValue('Santo Dios')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard and leave' }))
    expect(await screen.findByText('Song library')).toBeInTheDocument()
  })

  it('shows a load error and retries without displaying an empty form', async () => {
    context.load.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ kind: 'new', row: null, form: songFormFromRow() })
    renderEditor()
    expect(await screen.findByRole('alert')).toHaveTextContent('network')
    expect(screen.queryByLabelText('Title *')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Title *')).toBeInTheDocument()
  })
})
