export type ExportItem = { songId: string; key?: string | null }

export function serializeExportItems(items: readonly ExportItem[]) {
  return items.map(({ songId, key }) => ({ song_id: songId, key: key ?? '' }))
}

export function songExportPayload(opts: {
  songId: string
  key?: string
  format?: 'pdf' | 'jpg'
}) {
  return {
    song_id: opts.songId,
    key: opts.key ?? '',
    format: opts.format ?? 'pdf',
  }
}

export function songbookExportPayload(opts: {
  items: readonly ExportItem[]
  title?: string
  subtitle?: string
  includeTOC?: boolean
  coverImageDataUrl?: string | null
}) {
  return {
    items: serializeExportItems(opts.items),
    title: opts.title ?? '',
    subtitle: opts.subtitle ?? '',
    include_toc: opts.includeTOC !== false,
    cover_image: opts.coverImageDataUrl || undefined,
  }
}

export function setlistExportPayload(items: readonly ExportItem[]) {
  return { items: serializeExportItems(items) }
}

export function responseFilename(
  contentDisposition: string | null,
  fallback: string,
): string {
  const encoded = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const quoted = contentDisposition?.match(/filename="([^"]+)"/i)?.[1]
  let candidate = encoded ? safeDecode(encoded) : quoted
  candidate = candidate?.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return candidate || fallback
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
