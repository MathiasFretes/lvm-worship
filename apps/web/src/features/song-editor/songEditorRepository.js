import { canDirectWrite } from '@lavozmisionera/core'
import { slugFromTitle, songFormFromRow, songFormToRow, validateSongForm } from './songEditorModel'

export async function loadEditableSong(client, { slug, personalId }) {
  if (personalId) {
    const { data, error } = await client.from('personal_songs').select('*').eq('id', personalId).maybeSingle()
    if (error) throw error
    return data ? { kind: 'personal', row: data, form: songFormFromRow(data) } : null
  }
  if (!slug || slug === '_new_') return { kind: 'new', row: null, form: songFormFromRow() }
  const { data, error } = await client.from('songs').select('*').eq('slug', slug).eq('is_deleted', false).maybeSingle()
  if (error) throw error
  return data ? { kind: 'published', row: data, form: songFormFromRow(data) } : null
}

export async function findAvailableSlug(client, title, currentId) {
  const base = slugFromTitle(title)
  if (!base) throw new Error('The title cannot produce a URL slug')
  for (let number = 1; number <= 100; number += 1) {
    const slug = number === 1 ? base : `${base}_${number}`
    const { data, error } = await client.from('songs').select('id').eq('slug', slug).maybeSingle()
    if (error) throw error
    if (!data || data.id === currentId) return slug
  }
  throw new Error('No available URL slug for this title')
}

async function mutate(client, { action, form, existing, operationId = crypto.randomUUID() }) {
  const { data, error } = await client.rpc('mutate_editor_song', {
    p_operation_id: operationId,
    p_action: action,
    p_song_id: existing?.kind === 'published' ? existing.row.id : null,
    p_personal_song_id: existing?.kind === 'personal' ? existing.row.id : null,
    p_payload: songFormToRow(form),
    p_expected_updated_at: existing?.row?.updated_at || null,
  })
  if (error) throw error
  return { ...data, form: songFormFromRow(data?.row || songFormToRow(form)) }
}

export async function saveEditableSong(client, { form, existing, role, operationId }) {
  const errors = validateSongForm(form)
  if (Object.keys(errors).length) return { kind: 'invalid', errors }
  const action = existing?.kind === 'personal' ? 'save_draft' : canDirectWrite(role) ? 'save_published' : 'suggest'
  return mutate(client, { action, form, existing, operationId })
}

export async function submitEditableDraft(client, { form, existing, operationId }) {
  const errors = validateSongForm(form)
  if (Object.keys(errors).length) return { kind: 'invalid', errors }
  if (existing?.kind !== 'personal') throw new Error('A personal draft is required')
  return mutate(client, { action: 'submit_draft', form, existing, operationId })
}

export async function deleteEditableSong(client, { song, operationId = crypto.randomUUID() }) {
  if (!song?.id) throw new Error('A saved song is required')
  const { data, error } = await client.rpc('mutate_editor_song', {
    p_operation_id: operationId,
    p_action: 'delete',
    p_song_id: song.id,
    p_personal_song_id: null,
    p_payload: { title: song.title, slug: song.slug },
    p_expected_updated_at: song.updated_at || null,
  })
  if (error) throw error
  return data.kind === 'deleted' ? 'deleted' : 'requested'
}
