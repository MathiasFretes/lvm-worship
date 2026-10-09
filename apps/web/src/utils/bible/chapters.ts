import { publicUrl } from '../network/publicUrl'
import { getDefaultBibleTranslationId, listBibleTranslations, normalizeBibleTranslationId } from './translations'
import {
  normalizeChapterPayload,
  type ChapterData,
} from '@lavozmisionera/core'

export type { ChapterData }

type ChapterQuery = {
  translationId?: string
  book: string
  chapter: number
  signal?: AbortSignal
}
export async function fetchBibleChapter({ translationId, book, chapter, signal }: ChapterQuery){
  const resolved = await resolveTranslation(translationId)
  const root = resolved.dataRoot.replace(/^\/+/, '')
  const url = publicUrl(`${root}/${encodeURIComponent(book)}/${chapter}.json`)
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Failed to load passage (${res.status})`)
  if (!res.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error('Bible chapter response is not JSON')
  }
  const payload = await res.json()
  return normalizeChapterPayload(payload, { book, chapter })
}

async function resolveTranslation(translationId?: string){
  const requestedId = normalizeBibleTranslationId(translationId || getDefaultBibleTranslationId())
  const { translations, defaultTranslationId } = await listBibleTranslations()
  return (
    translations.find((item) => item.id === requestedId)
    || translations.find((item) => item.id === defaultTranslationId)
    || translations[0]
    || {
      id: requestedId,
      label: requestedId.toUpperCase(),
      name: requestedId.toUpperCase(),
      language: 'en',
      dataRoot: `bible/en/${requestedId}`,
    }
  )
}
