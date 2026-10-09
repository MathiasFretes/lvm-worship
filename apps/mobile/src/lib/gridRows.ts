// Chunk a section's items into grid rows of `columns` cells, row-major (the
// tablet Song Library grid: reading order flows left→right, then down, within
// each letter section). The final row keeps its remainder — the renderer pads
// it with empty flex cells. Never emits an empty row.
export function chunkRows<T>(items: T[], columns: number): T[][] {
  const size = Math.max(1, Math.floor(columns))
  const rowCount = Math.ceil(items.length / size)
  return Array.from({ length: rowCount }, (_, row) => {
    const start = row * size
    return items.slice(start, start + size)
  })
}
