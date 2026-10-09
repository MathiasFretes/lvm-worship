import { canDirectWrite, hasMinRole, submitSongSuggestion, updatePersonalSong } from '@lavozmisionera/core'
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

async function recordAudit(client, actorId, action, row, payload) {
  if (!actorId) return
  const { error } = await client.from('editor_audit_log').insert({
    actor_id: actorId,
    action,
    song_id: row?.id || null,
    song_slug: row?.slug || null,
    song_title: payload.title,
    payload_snapshot: payload,
  })
  if (error) console.error('[songEditor] Audit log failed:', error)
}

export async function saveEditableSong(client, { form, existing, role, actorId }) {
  const errors = validateSongForm(form)
  if (Object.keys(errors).length) return { kind: 'invalid', errors }
  const payload = songFormToRow(form)

  if (existing?.kind === 'personal') {
    const row = await updatePersonalSong(client, existing.row.id, payload)
    return { kind: 'personal', row, form: songFormFromRow(row) }
  }

  if (!canDirectWrite(role)) {
    await submitSongSuggestion(client, {
      type: existing?.kind === 'published' ? 'edit' : 'addition',
      payload,
      songId: existing?.row?.id || null,
      personalSongId: null,
    })
    await recordAudit(client, actorId, 'suggestion_submitted', existing?.row, payload)
    return { kind: 'suggestion', form: songFormFromRow(payload) }
  }

  const slug = existing?.kind === 'published' && payload.title === existing.row.title?.trim()
    ? existing.row.slug
    : await findAvailableSlug(client, payload.title, existing?.row?.id)
  const now = new Date().toISOString()
  const query = existing?.kind === 'published'
    ? client.from('songs').update({ ...payload, slug, updated_at: now }).eq('id', existing.row.id)
    : client.from('songs').insert({ ...payload, slug, is_deleted: false, created_at: now, updated_at: now })
  const { data, error } = await query.select().single()
  if (error) throw error
  await recordAudit(client, actorId, 'direct_save', data, payload)
  return { kind: 'published', row: data, form: songFormFromRow(data) }
}

export async function deleteEditableSong(client, { song, role, actorId }) {
  if (!song?.id) throw new Error('A saved song is required')
  const payload = { slug: song.slug, title: song.title }
  if (hasMinRole(role, 'admin')) {
    const { error } = await client.from('songs').update({ is_deleted: true }).eq('id', song.id)
    if (error) throw error
    await recordAudit(client, actorId, 'deleted', song, payload)
    return 'deleted'
  }
  await submitSongSuggestion(client, { type: 'deletion', payload, songId: song.id, personalSongId: null })
  await recordAudit(client, actorId, 'suggestion_submitted', song, payload)
  return 'requested'
}
