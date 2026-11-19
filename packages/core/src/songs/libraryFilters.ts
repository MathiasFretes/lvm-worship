export type LibraryFilters = {
  key: string
  minBpm: string
  maxBpm: string
  source: 'all' | 'catalog' | 'personal'
}
export const EMPTY_LIBRARY_FILTERS: LibraryFilters = { key: '', minBpm: '', maxBpm: '', source: 'all' }
type FilterSong = {
  default_key?: string | null
  originalKey?: string | null
  tempo?: number | null
  source?: string
  isPersonal?: boolean
}

export function libraryKey(value: string) {
  return value.trim().replaceAll('♯', '#').replaceAll('♭', 'b').toUpperCase()
}

function bpm(value: string) {
  return value.trim() ? /^\d{1,3}$/.test(value.trim()) && Number(value) > 0 ? Number(value) : NaN : null
}

export function validLibraryRange(filters: Pick<LibraryFilters, 'minBpm' | 'maxBpm'>) {
  const min = bpm(filters.minBpm), max = bpm(filters.maxBpm)
  return (min === null || Number.isFinite(min)) && (max === null || Number.isFinite(max)) &&
    (min === null || max === null || min <= max)
}

export function matchesLibraryFilters(song: FilterSong, filters: LibraryFilters) {
  if (!validLibraryRange(filters)) return false
  const personal = song.source === 'personal' || song.isPersonal === true
  if (filters.source === 'personal' && !personal || filters.source === 'catalog' && personal) return false
  if (filters.key && libraryKey(song.default_key || song.originalKey || '') !== libraryKey(filters.key)) return false
  const min = bpm(filters.minBpm), max = bpm(filters.maxBpm)
  if (min !== null || max !== null) {
    if (typeof song.tempo !== 'number' || !Number.isFinite(song.tempo)) return false
    if (min !== null && song.tempo < min || max !== null && song.tempo > max) return false
  }
  return true
}

export function availableLibraryKeys(songs: FilterSong[]) {
  const keys = new Map<string, string>()
  for (const song of songs) {
    const key = (song.default_key || song.originalKey || '').trim()
    if (key && !keys.has(libraryKey(key))) keys.set(libraryKey(key), key)
  }
  return [...keys.values()].sort((a, b) => a.localeCompare(b))
}
