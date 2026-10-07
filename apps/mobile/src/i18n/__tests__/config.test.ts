import { describe, expect, it } from 'vitest'
import { localeLabel, normalizeLanguageTag, resolveLanguage } from '../config'

const LVM_SUPPORTED = ['en', 'es', 'ko', 'tr'] as const

describe.each([{ product: 'LVM' }])('$product · resolveLanguage', () => {
  it('uses the stored pick when supported', () => {
    expect(resolveLanguage('tr', ['en-US'], LVM_SUPPORTED)).toBe('tr')
  })

  it('normalizes regional stored picks', () => {
    expect(resolveLanguage('ko-KR', ['en-US'], LVM_SUPPORTED)).toBe('ko')
  })

  it('ignores an unsupported stored pick and falls back to the device', () => {
    expect(resolveLanguage('fr', ['es-AR', 'en-US'], LVM_SUPPORTED)).toBe('es')
  })

  it('uses the first supported device language when nothing is stored', () => {
    expect(resolveLanguage(null, ['de-DE', 'tr-TR', 'en-US'], LVM_SUPPORTED)).toBe('tr')
  })

  it('falls back to English when neither stored nor device languages are supported', () => {
    expect(resolveLanguage(null, ['de-DE', 'fr-FR'], LVM_SUPPORTED)).toBe('en')
    expect(resolveLanguage(null, [], LVM_SUPPORTED)).toBe('en')
  })

  it('treats empty stored values as follow-device', () => {
    expect(resolveLanguage('', ['tr-TR'], LVM_SUPPORTED)).toBe('tr')
    expect(resolveLanguage(undefined, ['tr-TR'], LVM_SUPPORTED)).toBe('tr')
  })
})

describe.each([{ product: 'LVM' }])('$product · normalizeLanguageTag', () => {
  it('lowercases and strips region for - and _ separators', () => {
    expect(normalizeLanguageTag('ko-KR')).toBe('ko')
    expect(normalizeLanguageTag('en_US')).toBe('en')
    expect(normalizeLanguageTag(' TR ')).toBe('tr')
    expect(normalizeLanguageTag(null)).toBe('')
    expect(normalizeLanguageTag({ languageCode: 'es' })).toBe('')
  })
})

describe.each([{ product: 'LVM' }])('$product · localeLabel', () => {
  it('returns native names for known codes and uppercased codes otherwise', () => {
    expect(localeLabel('en')).toBe('English')
    expect(localeLabel('es')).toBe('Español')
    expect(localeLabel('ko')).toBe('한국어')
    expect(localeLabel('tr')).toBe('Türkçe')
    expect(localeLabel('xx')).toBe('XX')
  })
})
