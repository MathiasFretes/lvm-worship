import { File, Paths } from 'expo-file-system'
import { apiError, apiPost } from './api'
import { markSessionError } from './sessionError'
import {
  responseFilename,
  setlistExportPayload,
  songbookExportPayload,
  songExportPayload,
  type ExportItem,
} from './exportPayloads'

// Server-side song export. Calls the web app's Pages Function
// POST /api/export/song, which renders with the same pure pdf_mvp engine the
// web app uses and returns the bytes (PDF, or a PNG raster of page 1 for
// 'jpg' — the server has no JPG encoder, and share sheets don't care).
// The bytes are written to the app cache and the local URI returned for
// expo-sharing / the system share sheet.

export type ExportFormat = 'pdf' | 'jpg'

export async function exportSong(opts: {
  songId: string
  key?: string
  format?: ExportFormat
}): Promise<string> {
  const format = opts.format ?? 'pdf'
  const res = await apiPost('/api/export/song', songExportPayload(opts))

  // 501 = server rasteriser unavailable; caller should offer PDF instead. It is
  // the one export failure that does not pass through apiError, so it marks the
  // session itself — the user still tapped JPG and got an alert instead.
  if (res.status === 501) {
    markSessionError('exportSong.imageUnavailable')
    throw new Error('image_unavailable')
  }
  if (!res.ok) throw await apiError(res, 'export_failed')

  const contentType = res.headers.get('content-type') || ''
  const ext = contentType.includes('pdf') ? 'pdf' : 'png'
  return cacheResponse(res, responseFilename(
    res.headers.get('content-disposition'),
    `song-export.${ext}`,
  ))
}

// Songbook export: renders the selected songs to one PDF via the web app's
// POST /api/export/songbook — a cover page, an optional numbered table of
// contents, then every song (one per page) in alphabetical order. Songs render
// in their default key. Writes the bytes to the app cache and returns the local
// URI for expo-sharing.
export async function exportSongbook(opts: {
  items: ExportItem[]
  title?: string
  subtitle?: string
  includeTOC?: boolean
  coverImageDataUrl?: string | null
}): Promise<string> {
  const res = await apiPost('/api/export/songbook', songbookExportPayload(opts))

  if (!res.ok) throw await apiError(res, 'export_failed')
  return cacheResponse(
    res,
    responseFilename(res.headers.get('content-disposition'), 'songbook.pdf'),
  )
}

// Whole-set export: renders the ordered setlist to one combined PDF via the
// web app's POST /api/export/setlist (the multi-song counterpart of
// /api/export/song), writes the bytes to the app cache, and returns the local
// URI for expo-sharing. PDF only — sets have no image scope.
export async function exportSetlist(
  items: ExportItem[],
): Promise<string> {
  const res = await apiPost('/api/export/setlist', setlistExportPayload(items))

  if (!res.ok) throw await apiError(res, 'export_failed')
  return cacheResponse(
    res,
    responseFilename(res.headers.get('content-disposition'), 'setlist.pdf'),
  )
}

async function cacheResponse(res: Response, filename: string): Promise<string> {
  const file = new File(Paths.cache, filename)
  if (file.exists) file.delete()
  file.write(new Uint8Array(await res.arrayBuffer()))
  return file.uri
}
