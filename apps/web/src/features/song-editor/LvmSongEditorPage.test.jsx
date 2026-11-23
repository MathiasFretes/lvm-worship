import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '../../i18n'
import LvmSongEditorPage from './LvmSongEditorPage'
import { songFormFromRow } from './songEditorModel'

const context = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), songs: [], role: 'editor', refresh: vi.fn() }))
vi.mock('./songEditorRepository', () => ({ loadEditableSong: context.load, saveEditableSong: context.save }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'user-1' } }, role: context.role, hasMinRole: () => true }) }))
vi.mock('../../hooks/useRole', () => ({ useRole: () => ({ role: context.role, isAtLeast: role => role === 'editor' }) }))
vi.mock('../../hooks/useSongs', () => ({ useSongs: () => ({ songs: context.songs, loading: false, error: null, retry: context.refresh }) }))
vi.mock('./PptxAttachment', () => ({ PptxAttachment: () => <p>PPTX attachment</p> }))
vi.mock('../../components/editor/SuggestionReviewPanel', () => ({ default: ({ onApproved }) => <button onClick={onApproved}>Approve fixture</button> }))
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
  for (const key of Object.keys(localStorage)) if (key.startsWith('lvm.editor-draft.v1:')) localStorage.removeItem(key)
  context.load.mockReset()
  context.save.mockReset()
  context.refresh.mockReset().mockResolvedValue([])
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
    await waitFor(() => expect(context.refresh).toHaveBeenCalledOnce())
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


it('uses Spanish for the editor and validation while language changes preserve unsaved work', async () => {
  await i18n.changeLanguage('es')
  renderEditor()
  await screen.findByRole('heading', { name: 'Nueva canción' })
  expect(screen.getByRole('region', { name: 'Datos de la canción' })).toBeInTheDocument()
  expect(screen.getByLabelText('Tono *')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guía de ChordPro' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Guardar canción' }))
  expect(screen.getByText('El título es obligatorio')).toBeInTheDocument()
  expect(screen.getByText('El tono es obligatorio')).toBeInTheDocument()
  expect(screen.getByText('Agregá al menos una etiqueta')).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: /^Título/ }), 'Borrador sin guardar')
  fireEvent.change(screen.getByLabelText('Letra con acordes en ChordPro'), { target: { value: '[G]Mi canción' } })
  await act(async () => { await i18n.changeLanguage('en') })
  expect(screen.getByRole('textbox', { name: /^Title/ })).toHaveValue('Borrador sin guardar')
  expect(screen.getByLabelText('ChordPro song body')).toHaveValue('[G]Mi canción')
  await act(async () => { await i18n.changeLanguage('es') })
  expect(screen.getByRole('textbox', { name: /^Título/ })).toHaveValue('Borrador sin guardar')
  expect(context.load).toHaveBeenCalledTimes(1)
  expect(context.save).not.toHaveBeenCalled()
})


it('reloads the published form after approval and refreshes the library', async () => {
  const row = { id: 'song-review', slug: 'review', title: 'Review', default_key: 'G', tags: ['QA'], chordpro_content: '[G]Before' }
  const approved = { ...row, chordpro_content: '[D]Approved' }
  context.load.mockResolvedValueOnce({ kind: 'published', row, form: songFormFromRow(row) })
    .mockResolvedValue({ kind: 'published', row: approved, form: songFormFromRow(approved) })
  renderEditor('/portal/editor/review')
  await screen.findByDisplayValue('[G]Before')
  await userEvent.click(screen.getByRole('button', { name: 'Approve fixture' }))
  expect(await screen.findByDisplayValue('[D]Approved')).toBeInTheDocument()
  expect(context.refresh).toHaveBeenCalledOnce()
})

it('keeps unsaved edits on approval and loads the approved version when they are discarded', async () => {
  const row = { id: 'song-review', slug: 'review', title: 'Review', default_key: 'G', tags: ['QA'], chordpro_content: '[G]Before' }
  const approved = { ...row, chordpro_content: '[D]Approved' }
  context.load.mockResolvedValueOnce({ kind: 'published', row, form: songFormFromRow(row) })
    .mockResolvedValue({ kind: 'published', row: approved, form: songFormFromRow(approved) })
  renderEditor('/portal/editor/review')
  await screen.findByDisplayValue('[G]Before')
  fireEvent.change(screen.getByLabelText('ChordPro song body'), { target: { value: '[C]Unsaved local edit' } })
  await userEvent.click(screen.getByRole('button', { name: 'Approve fixture' }))
  expect(screen.getByLabelText('ChordPro song body')).toHaveValue('[C]Unsaved local edit')
  expect(context.load).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('Suggestion approved.')
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(await screen.findByDisplayValue('[D]Approved')).toBeInTheDocument()
  expect(context.save).not.toHaveBeenCalled()
})


it('recovers the unsaved form and the same operation ID after an acknowledgement failure and remount', async () => {
  context.save.mockRejectedValueOnce(new Error('Lost acknowledgement'))
    .mockImplementationOnce(async (_, { form }) => ({ kind: 'published', row: { id: 'song-resume', slug: 'resume', ...form }, form }))
  const first = renderEditor()
  await screen.findByRole('heading', { name: 'New song' })
  await userEvent.type(screen.getByLabelText('Title *'), 'Resume')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /^Key/ }), 'G')
  await userEvent.type(screen.getByLabelText('Tags *'), 'QA')
  fireEvent.change(screen.getByLabelText('ChordPro song body'), { target: { value: '[G]Recovered lyrics' } })
  await userEvent.click(screen.getByRole('button', { name: 'Save song' }))
  await screen.findByRole('alert')
  const operation = context.save.mock.calls[0][1].operationId
  first.unmount()
  renderEditor()
  expect(await screen.findByDisplayValue('Resume')).toBeInTheDocument()
  expect(screen.getByLabelText('ChordPro song body')).toHaveValue('[G]Recovered lyrics')
  await userEvent.click(screen.getByRole('button', { name: 'Save song' }))
  await waitFor(() => expect(context.save).toHaveBeenCalledTimes(2))
  expect(context.save.mock.calls[1][1].operationId).toBe(operation)
})
