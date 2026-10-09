import { supabase } from '../../lib/supabase'

export async function loadDashboardSongs() {
  const { data, count, error } = await supabase
    .from('songs')
    .select('slug, title, artist, default_key', { count: 'exact' })
    .eq('is_deleted', false)
    .order('title')
    .limit(6)

  if (error) throw error

  return {
    total: count ?? data?.length ?? 0,
    songs: (data || [])
      .filter(song => song.slug && song.title)
      .map(song => ({
        id: song.slug,
        title: song.title,
        artist: song.artist || '',
        key: song.default_key || '',
      })),
  }
}
