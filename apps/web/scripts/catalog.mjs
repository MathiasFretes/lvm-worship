export async function loadPublicCatalog() {
  const url = new URL(process.env.LVM_CATALOG_URL)
  url.searchParams.set('select', 'title,artist,slug,updated_at')
  url.searchParams.set('is_deleted', 'eq.false')
  url.searchParams.set('order', 'title')
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Catalog returned HTTP ${response.status}`)
  const songs = await response.json()
  if (!Array.isArray(songs)) throw new Error('Invalid catalog response')
  return songs
}
