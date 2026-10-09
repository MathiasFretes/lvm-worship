export const EMPTY_SONG = Object.freeze({
  title: '',
  artist: '',
  default_key: '',
  tempo: '',
  time_signature: '',
  country: '',
  youtube_id: '',
  language: '',
  pptx_url: '',
  tags: [],
  chordpro_content: '',
})

export function songFormFromRow(row = {}) {
  return {
    title: row.title || '',
    artist: row.artist || '',
    default_key: row.default_key || '',
    tempo: row.tempo ?? '',
    time_signature: row.time_signature || '',
    country: row.country || '',
    youtube_id: row.youtube_id || '',
    language: row.language || '',
    pptx_url: row.pptx_url || '',
    tags: Array.isArray(row.tags) ? [...row.tags] : [],
    chordpro_content: row.chordpro_content || '',
  }
}

export function validateSongForm(form) {
  const errors = {}
  if (!form.title?.trim()) errors.title = 'Title is required'
  if (!form.default_key?.trim()) errors.default_key = 'Key is required'
  if (!Array.isArray(form.tags) || !form.tags.some(tag => tag.trim())) {
    errors.tags = 'At least one tag is required'
  }
  if (form.tempo !== '' && form.tempo != null && (!Number.isInteger(Number(form.tempo)) || Number(form.tempo) < 20 || Number(form.tempo) > 400)) {
    errors.tempo = 'Tempo must be between 20 and 400 BPM'
  }
  if (form.youtube_id && !youtubeId(form.youtube_id)) errors.youtube_id = 'Enter a valid YouTube ID or URL'
  return errors
}

export function youtubeId(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^[\w-]{11}$/.test(raw)) return raw
  const match = raw.match(/(?:[?&]v=|youtu\.be\/|shorts\/)([\w-]{11})(?:\b|[?&#/]|$)/)
  return match?.[1] || ''
}

export function songFormToRow(form) {
  const tags = [...new Set((form.tags || []).map(tag => tag.trim()).filter(Boolean))]
  return {
    title: form.title.trim(),
    artist: form.artist?.trim() || null,
    default_key: form.default_key || null,
    tempo: form.tempo === '' || form.tempo == null ? null : Number(form.tempo),
    time_signature: form.time_signature || null,
    country: form.country?.trim() || null,
    youtube_id: youtubeId(form.youtube_id) || null,
    language: form.language || null,
    pptx_url: form.pptx_url || null,
    tags,
    chordpro_content: form.chordpro_content || '',
  }
}

export function slugFromTitle(title) {
  return String(title || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
}

export function readChordProFile(text) {
  if (!text.trim()) throw new Error('The ChordPro file is empty')
  const fields = {}
  const body = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.trim().match(/^\{(title|artist|composer|key|tag|tags):\s*(.*?)\}$/i)
    if (!match) { body.push(line); continue }
    const key = match[1].toLowerCase()
    const value = match[2].trim()
    if (key === 'title') fields.title = value
    else if (key === 'key') fields.default_key = value
    else if (key === 'tag' || key === 'tags') fields.tags = value.split(',').map(tag => tag.trim()).filter(Boolean)
    else fields.artist = value
  }
  return { ...songFormFromRow(), ...fields, chordpro_content: body.join('\n').trim() }
}
