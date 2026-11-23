import { describe, expect, it, vi } from 'vitest'
import { deleteEditableSong, findAvailableSlug, loadEditableSong, saveEditableSong, submitEditableDraft } from './songEditorRepository'

function query(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
  }
  return chain
}

const form = { title: 'Niño de Belén', artist: 'Equipo', default_key: 'G', tags: ['Navidad'], chordpro_content: '{start_of_chorus}\n[G]Gloria\n{end_of_chorus}' }

describe('LVM song editor repository', () => {
  it('distinguishes new, missing and existing songs without masking query errors', async () => {
    const existing = query({ data: { id: 'one', slug: 'santo', title: 'Santo', tags: [] }, error: null })
    const client = { from: vi.fn(() => existing) }
    expect((await loadEditableSong(client, {})).kind).toBe('new')
    expect((await loadEditableSong(client, { slug: 'santo' })).form.title).toBe('Santo')
    expect(await loadEditableSong({ from: () => query({ data: null, error: null }) }, { slug: 'missing' })).toBeNull()
    await expect(loadEditableSong({ from: () => query({ data: null, error: new Error('offline') }) }, { slug: 'santo' })).rejects.toThrow('offline')
  })

  it('does not treat a slug lookup failure as an available slug', async () => {
    const client = { from: () => query({ data: null, error: new Error('offline') }) }
    await expect(findAvailableSlug(client, 'Santo')).rejects.toThrow('offline')
  })

  it('sends publication and its expected revision through one server transaction', async () => {
    const saved = { id: 'uuid-1', slug: 'nino_de_belen', ...form }
    const client = { rpc: vi.fn(async () => ({ data: { kind: 'published', row: saved }, error: null })), from: vi.fn() }
    const created = await saveEditableSong(client, { form, existing: { kind: 'new' }, role: 'editor', operationId: 'operation-1' })
    expect(created.kind).toBe('published')
    expect(client.rpc).toHaveBeenCalledWith('mutate_editor_song', expect.objectContaining({ p_operation_id: 'operation-1', p_action: 'save_published', p_payload: expect.objectContaining({ chordpro_content: form.chordpro_content }) }))
    await saveEditableSong(client, { form, existing: { kind: 'published', row: { ...saved, updated_at: '2026-11-23T10:00:00Z' } }, role: 'editor' })
    expect(client.rpc).toHaveBeenLastCalledWith('mutate_editor_song', expect.objectContaining({ p_song_id: 'uuid-1', p_expected_updated_at: '2026-11-23T10:00:00Z' }))
    expect(client.from).not.toHaveBeenCalled()
  })

  it('requests review for an ordinary user without direct table writes', async () => {
    const client = { rpc: vi.fn(async () => ({ data: { kind: 'suggestion', suggestionId: 'suggestion-1' }, error: null })), from: vi.fn() }
    const result = await saveEditableSong(client, { form, existing: { kind: 'new' }, role: 'user' })
    expect(result.kind).toBe('suggestion')
    expect(client.rpc).toHaveBeenCalledWith('mutate_editor_song', expect.objectContaining({ p_action: 'suggest', p_song_id: null }))
    expect(client.from).not.toHaveBeenCalled()
  })

  it('saves and submits private drafts with single atomic commands', async () => {
    const client = { rpc: vi.fn(async () => ({ data: { kind: 'personal', row: form }, error: null })), from: vi.fn() }
    const existing = { kind: 'personal', row: { id: 'draft-1' } }
    expect((await saveEditableSong(client, { form, existing, role: 'user' })).kind).toBe('personal')
    expect(client.rpc).toHaveBeenLastCalledWith('mutate_editor_song', expect.objectContaining({ p_action: 'save_draft', p_personal_song_id: 'draft-1' }))
    await submitEditableDraft(client, { form, existing })
    expect(client.rpc).toHaveBeenLastCalledWith('mutate_editor_song', expect.objectContaining({ p_action: 'submit_draft', p_personal_song_id: 'draft-1', p_payload: expect.objectContaining({ title: form.title }) }))
    expect(client.from).not.toHaveBeenCalled()
  })

  it('propagates transaction errors and reuses the caller operation ID on retry', async () => {
    const client = { rpc: vi.fn().mockResolvedValueOnce({ error: new Error('Lost acknowledgement') }).mockResolvedValueOnce({ data: { kind: 'published', row: form }, error: null }) }
    const input = { form, existing: { kind: 'new' }, role: 'editor', operationId: 'same-operation' }
    await expect(saveEditableSong(client, input)).rejects.toThrow('Lost acknowledgement')
    await saveEditableSong(client, input)
    expect(client.rpc.mock.calls.map(call => call[1].p_operation_id)).toEqual(['same-operation', 'same-operation'])
  })

  it('rejects incomplete forms before any database write', async () => {
    const client = { from: vi.fn() }
    const result = await saveEditableSong(client, { form: { ...form, title: '' }, existing: { kind: 'new' }, role: 'editor' })
    expect(result.kind).toBe('invalid')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('leaves delete-versus-request authorization to PostgreSQL', async () => {
    const client = { rpc: vi.fn().mockResolvedValueOnce({ data: { kind: 'suggestion' }, error: null }).mockResolvedValueOnce({ data: { kind: 'deleted' }, error: null }) }
    const song = { id: 'song-1', title: 'Santo', slug: 'santo' }
    expect(await deleteEditableSong(client, { song, role: 'editor' })).toBe('requested')
    expect(await deleteEditableSong(client, { song, role: 'admin' })).toBe('deleted')
    expect(client.rpc).toHaveBeenCalledWith('mutate_editor_song', expect.objectContaining({ p_action: 'delete', p_song_id: 'song-1' }))
  })
})
