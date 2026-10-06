import { describe, expect, it, vi } from 'vitest'
import { deleteEditableSong, findAvailableSlug, loadEditableSong, saveEditableSong } from './songEditorRepository'

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

  it('inserts a new song and updates an existing song by UUID', async () => {
    const slugQuery = query({ data: null, error: null })
    const saved = { id: 'uuid-1', slug: 'nino_de_belen', ...form }
    const writeQuery = query({ data: saved, error: null })
    const client = { from: vi.fn(table => table === 'songs' ? (client.from.mock.calls.length % 2 ? slugQuery : writeQuery) : query({ data: null, error: null })) }

    const created = await saveEditableSong(client, { form, existing: { kind: 'new', row: null }, role: 'editor' })
    expect(created.kind).toBe('published')
    expect(writeQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ slug: 'nino_de_belen', chordpro_content: form.chordpro_content }))

    client.from.mockClear()
    const updated = await saveEditableSong(client, { form: { ...form, title: 'Niño de Belén nuevo' }, existing: { kind: 'published', row: saved }, role: 'editor' })
    expect(updated.kind).toBe('published')
    expect(writeQuery.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Niño de Belén nuevo' }))
    expect(writeQuery.eq).toHaveBeenCalledWith('id', 'uuid-1')
  })

  it('keeps the existing URL slug when the title did not change', async () => {
    const saved = { id: 'uuid-2', slug: 'historic-slug', ...form }
    const write = query({ data: saved, error: null })
    const client = { from: vi.fn(() => write) }
    await saveEditableSong(client, { form, existing: { kind: 'published', row: saved }, role: 'editor' })
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(write.update).toHaveBeenCalledWith(expect.objectContaining({ slug: 'historic-slug' }))
  })

  it('submits a review suggestion for a user without writing the public catalog', async () => {
    const suggestion = query({ data: { id: 'suggestion-1' }, error: null })
    const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) }, from: vi.fn(() => suggestion) }
    const result = await saveEditableSong(client, { form, existing: { kind: 'new', row: null }, role: 'user' })
    expect(result.kind).toBe('suggestion')
    expect(client.from).toHaveBeenCalledWith('song_suggestions')
    expect(client.from).not.toHaveBeenCalledWith('songs')
    expect(suggestion.insert).toHaveBeenCalledWith(expect.objectContaining({ type: 'addition', suggested_by: 'user-1' }))
  })

  it('updates the owner-scoped personal draft instead of creating a public song', async () => {
    const updated = { id: 'draft-1', ...form }
    const personal = query({ data: updated, error: null })
    const client = { from: vi.fn(() => personal) }
    const result = await saveEditableSong(client, { form, existing: { kind: 'personal', row: { id: 'draft-1' } }, role: 'user' })
    expect(result.kind).toBe('personal')
    expect(client.from).toHaveBeenCalledWith('personal_songs')
    expect(client.from).not.toHaveBeenCalledWith('songs')
    expect(personal.eq).toHaveBeenCalledWith('id', 'draft-1')
  })

  it('rejects incomplete forms before any database write', async () => {
    const client = { from: vi.fn() }
    const result = await saveEditableSong(client, { form: { ...form, title: '' }, existing: { kind: 'new' }, role: 'editor' })
    expect(result.kind).toBe('invalid')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('soft-deletes only for admins and submits a deletion request for editors', async () => {
    const song = { id: 'song-1', slug: 'santo', title: 'Santo' }
    const deleteQuery = query({ data: null, error: null })
    const suggestionQuery = query({ data: { id: 'suggestion-1' }, error: null })
    const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'editor-1' } }, error: null })) }, from: vi.fn(table => table === 'songs' ? deleteQuery : suggestionQuery) }
    expect(await deleteEditableSong(client, { song, role: 'editor' })).toBe('requested')
    expect(deleteQuery.update).not.toHaveBeenCalled()
    expect(suggestionQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ type: 'deletion', song_id: 'song-1' }))
    expect(await deleteEditableSong(client, { song, role: 'admin' })).toBe('deleted')
    expect(deleteQuery.update).toHaveBeenCalledWith({ is_deleted: true })
  })
})
