// Song slug helpers, shared by web + mobile.
//
// `slugify` is pure. `deriveUniqueSlug` is client-injected (like songsRepo /
// setlistsRepo) so it can probe the target table for collisions. Personal-song
// slugs are scoped per owner; public `songs` slugs are globally unique.

/** Lowercase, underscore-separated, URL-safe slug from a title. */
export function slugify(title: string): string {
  return String(title || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('_')
}

/**
 * Derive a slug that doesn't collide with existing rows. Appends `_2`, `_3`…
 * until free. A row whose id equals `currentId` doesn't count as a collision
 * (so re-saving an existing song keeps its slug).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} title
 * @param {{ currentId?: string, table?: string, ownerId?: string }} [opts]
 *   `table` defaults to 'songs'. Pass `ownerId` to scope uniqueness to one
 *   owner (personal_songs).
 * @returns {Promise<string>}
 */
export async function deriveUniqueSlug(
  client: any,
  title: string,
  opts: { currentId?: string; table?: string; ownerId?: string } = {},
): Promise<string> {
  const { currentId, table = 'songs', ownerId } = opts
  const base = slugify(title)
  if (!base) return ''
  for (let attempt = 1; ; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}_${attempt}`
    let query = client.from(table).select('id').eq('slug', candidate)
    if (ownerId) query = query.eq('owner_id', ownerId)
    const { data } = await query.maybeSingle()
    if (!data || data.id === currentId) return candidate
  }
}
