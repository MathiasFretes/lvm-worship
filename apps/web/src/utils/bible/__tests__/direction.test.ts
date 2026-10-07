import { describe, expect, it } from 'vitest'
import { isRtlBibleLanguage, normalizeBibleLanguageCode } from '../direction'

describe('LVM Scripture reading direction', () => {
  it.each([
    [' FA_IR ', 'fa-ir'],
    ['AR', 'ar'],
    ['he_IL', 'he-il'],
  ])('normalizes translation language %j to %j', (input, normalized) => {
    expect(normalizeBibleLanguageCode(input)).toBe(normalized)
  })

  it.each([
    ['Arabic', 'ar', true],
    ['Persian regional tag', 'fa-IR', true],
    ['Hebrew', 'he', true],
    ['legacy Hebrew', 'iw', true],
    ['English', 'en', false],
    ['Spanish', 'es', false],
    ['Turkish', 'tr', false],
    ['Korean', 'ko', false],
    ['unspecified', '', false],
  ])('renders %s passages right-to-left: %s', (_label, language, rtl) => {
    expect(isRtlBibleLanguage(language)).toBe(rtl)
  })
})
