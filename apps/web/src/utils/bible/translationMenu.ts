import {
  buildBibleTranslationGroups as buildSharedGroups,
  translationOptionLabel,
  type BibleTranslation,
  type BibleTranslationGroup,
} from '@lavozmisionera/core'

export type { BibleTranslationGroup }
export { translationOptionLabel }

export function buildBibleTranslationGroups(
  translations: BibleTranslation[],
  locale?: string
){
  return buildSharedGroups(translations, locale || inferLocale())
}
function inferLocale(){
  try {
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  } catch {}
  return 'en'
}
