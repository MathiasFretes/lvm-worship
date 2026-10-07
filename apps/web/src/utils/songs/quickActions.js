// Shared helpers for quick action logic (tag matching and random picks)
export function normalizeTag(tag){
  return String(tag || '').trim().toLowerCase()
}

export function hasTag(song, tag){
  const needle = normalizeTag(tag)
  if (!needle) return false
  return Array.isArray(song?.tags) && song.tags.some((value) => normalizeTag(value) === needle)
}

export function filterByTag(songs = [], tag){
  const needle = normalizeTag(tag)
  if (!needle) return []
  return songs.filter((s) => hasTag(s, needle))
}

export function pickRandom(list = []){
  if (!Array.isArray(list) || !list.length) return null
  const idx = randomIndex(list.length)
  return list[idx] ?? null
}

export function pickManyRandom(list = [], count = 0){
  const pool = Array.isArray(list) ? list.filter(Boolean) : []
  const out = []
  const target = Math.min(pool.length, Math.max(0, Math.trunc(Number(count) || 0)))
  while (out.length < target){
    const idx = randomIndex(pool.length)
    const [chosen] = pool.splice(idx, 1)
    out.push(chosen)
  }
  return out
}

function randomIndex(length){
  if (length <= 1) return 0
  return Math.min(length - 1, Math.floor(Math.random() * length))
}
