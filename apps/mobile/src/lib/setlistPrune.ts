export type PrunableSetlist = {
  id: string
  created_at: string
}

export function oldestSetlistsFirst<T extends PrunableSetlist>(setlists: readonly T[]): T[] {
  return setlists.slice().sort((a, b) => timestamp(a.created_at) - timestamp(b.created_at))
}

export function togglePruneSelection(
  selected: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function timestamp(value: string): number {
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : 0
}
