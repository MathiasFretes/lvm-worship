import { publicUrl } from '../network/publicUrl'
import { normalizeLanguageCode as normalizeSongLanguageCode, detectUiLanguage } from '../songs/songCatalog'
import { LOCALE_STORAGE_KEY } from '../../i18n/config'
import {
  fetchBibleTranslations,
  getDefaultBibleTranslationId,
  getFallbackBibleTranslations,
  normalizeBibleTranslationId,
  resolveBibleTranslationLabel,
  resolveBibleTranslationSelection,
  type BibleTranslation,
} from '@lavozmisionera/core'

export type { BibleTranslation }
export {
  getDefaultBibleTranslationId,
  getFallbackBibleTranslations,
  normalizeBibleTranslationId,
  resolveBibleTranslationLabel,
  resolveBibleTranslationSelection,
}
const DEFAULT_BIBLE_TRANSLATION_ID = getDefaultBibleTranslationId()
const PREFERENCE_KEY = 'pref:bibleTranslation'

const FALLBACK_TRANSLATIONS = getFallbackBibleTranslations()

let translationsPromise: Promise<{ translations: BibleTranslation[], defaultTranslationId: string }> | null = null

export function readBibleTranslationPreference(){
  try {
    if (typeof window === 'undefined') return ''
    const raw = window.localStorage.getItem(PREFERENCE_KEY)
    if (!raw) return ''
    return normalizeBibleTranslationId(raw)
  } catch {
    return ''
  }
}

export function writeBibleTranslationPreference(translationId: string){
  try {
    if (typeof window === 'undefined') return
    const raw = String(translationId || '').trim()
    if (!raw) return
    window.localStorage.setItem(PREFERENCE_KEY, normalizeBibleTranslationId(raw))
  } catch {}
}

export async function listBibleTranslations(options: { force?: boolean } = {}){
  if (!translationsPromise || options.force) {
    translationsPromise = fetchTranslations()
  }
  return translationsPromise
}

async function fetchTranslations(){
  const result = await fetchBibleTranslations('', async (path) => {
    const response = await fetch(publicUrl(path), { cache: 'no-store' })
    return response
  })
  return {
    translations: result.translations,
    defaultTranslationId: normalizeDefaultTranslationId(
      result.defaultTranslationId,
      result.translations
    ),
  }
}

function readUiLocale(): string {
  try {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(LOCALE_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function normalizeDefaultTranslationId(raw: unknown, translations: BibleTranslation[]){
  const uiLanguage = normalizeSongLanguageCode(readUiLocale() || detectUiLanguage(), 'en')

  if (uiLanguage === 'en' && translations.some((item) => item.id === DEFAULT_BIBLE_TRANSLATION_ID)) {
    return DEFAULT_BIBLE_TRANSLATION_ID
  }

  if (uiLanguage !== 'en') {
    const match = translations.find(
      (item) => normalizeSongLanguageCode(item.language, 'en') === uiLanguage
    )
    if (match?.id) return match.id
  }

  const requested = normalizeBibleTranslationId(raw)
  if (translations.some((item) => item.id === requested)) return requested
  if (translations.some((item) => item.id === DEFAULT_BIBLE_TRANSLATION_ID)) {
    return DEFAULT_BIBLE_TRANSLATION_ID
  }
  return translations[0]?.id || DEFAULT_BIBLE_TRANSLATION_ID
}
