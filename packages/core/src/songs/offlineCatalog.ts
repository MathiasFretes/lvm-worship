export const CATALOG_CACHE_BYTES = 16 * 1024 * 1024
export type CachedCatalogSong = {
  id: string; slug: string; title: string; artist: string | null; default_key: string | null
  time_signature: string | null; tags: string[] | null; tempo: number | null
  created_at: string | null; chordpro_content: string | null
}

function catalogRow(value: unknown): CachedCatalogSong {
  if (!value || typeof value !== 'object') throw new Error('Invalid catalog row')
  const row = value as Record<string, unknown>
  if (row.isPersonal || row.personalId || row.source && row.source !== 'catalog') throw new Error('Only public catalog songs may be cached')
  for (const field of ['id', 'slug', 'title']) {
    if (typeof row[field] !== 'string' || !row[field] || (row[field] as string).length > 1024) throw new Error('Invalid catalog identity')
  }
  const text = (field: string, limit = 1024) => {
    const value = row[field]
    if (value == null) return null
    if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid catalog text')
    return value
  }
  if (row.tags != null && (!Array.isArray(row.tags) || row.tags.length > 100 || row.tags.some(tag => typeof tag !== 'string' || tag.length > 1024))) throw new Error('Invalid catalog tags')
  if (row.tempo != null && (typeof row.tempo !== 'number' || !Number.isFinite(row.tempo))) throw new Error('Invalid catalog tempo')
  return {
    id: row.id as string, slug: row.slug as string, title: row.title as string,
    artist: text('artist'), default_key: text('default_key'), time_signature: text('time_signature'),
    created_at: text('created_at'), chordpro_content: text('chordpro_content', 256 * 1024),
    tempo: (row.tempo as number | null) ?? null, tags: (row.tags as string[] | null) ?? null,
  }
}

export function createOfflineCatalog(storage: { read: () => Promise<string | null>; write: (raw: string) => Promise<void> }) {
  let current: Promise<CachedCatalogSong[]> | undefined
  let pending: Promise<unknown> = Promise.resolve()
  let dirty = false
  function read() {
    current ??= storage.read().then(raw => {
      if (!raw || raw.length > CATALOG_CACHE_BYTES) return []
      try {
        const record = JSON.parse(raw)
        if (record.version !== 1 || !Array.isArray(record.songs) || record.songs.length > 10000) return []
        return record.songs.map(catalogRow)
      } catch { return [] }
    }).catch(() => [])
    return current
  }
  function encode(songs: CachedCatalogSong[]) {
    if (songs.length > 10000) throw new Error('Catalog exceeds offline budget')
    const raw = JSON.stringify({ version: 1, songs })
    if (raw.length > CATALOG_CACHE_BYTES) throw new Error('Catalog exceeds offline budget')
    return raw
  }
  function update(build: (songs: CachedCatalogSong[]) => CachedCatalogSong[]) {
    const operation = pending.then(async () => {
      const previous = await read()
      const songs = build(previous)
      const raw = encode(songs)
      if (!dirty && raw === encode(previous)) return
      current = Promise.resolve(songs)
      dirty = true
      await storage.write(raw)
      dirty = false
    })
    pending = operation.catch(() => {})
    return operation
  }
  return {
    read,
    write(rows: readonly unknown[]) {
      const songs = rows.map(catalogRow)
      encode(songs)
      return update(() => songs)
    },
    upsert(value: unknown) {
      const row = catalogRow(value)
      return update(songs => {
        const previous = songs.find(song => song.id === row.id || song.slug === row.slug)
        const merged = catalogRow({ ...previous, ...(value as Record<string, unknown>) })
        if (previous && JSON.stringify(previous) === JSON.stringify(merged)) return songs
        return [...songs.filter(song => song.id !== row.id && song.slug !== row.slug), merged]
      })
    },
  }
}
