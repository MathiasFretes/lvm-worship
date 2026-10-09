import { describe, it, expect } from 'vitest'
import {
  buildSongCatalog,
  hasGroupLanguage,
  normalizeSongEntry,
  resolveGroupEntry,
} from '../songCatalog'

describe('LVM multilingual song catalog', () => {
  it('links ministry translations and falls back to the English master', () => {
    const catalog = buildSongCatalog([
      {
        id: 'send-us-en',
        songId: 'send-us-lord',
        language: 'en',
        title: 'Send Us Lord',
        filename: 'send_us_lord_en.chordpro',
      },
      {
        id: 'send-us-es',
        songId: 'send-us-lord',
        language: 'es',
        title: 'Envíanos Señor',
        filename: 'envianos_senor_es.chordpro',
      },
      {
        id: 'only-en',
        title: 'Only English',
        filename: 'only_english.chordpro',
      },
    ])

    expect(catalog.groups).toHaveLength(2)
    expect(catalog.translationLanguages).toEqual(['en', 'es'])

    const group = catalog.groupBySongId.get('send-us-lord')
    expect(group?.languages).toEqual(['en', 'es'])

    expect(resolveGroupEntry(group, 'es')?.id).toBe('send-us-es')
    expect(resolveGroupEntry(group, 'ko')?.id).toBe('send-us-en')
    expect(hasGroupLanguage(group, 'es')).toBe(true)
    expect(hasGroupLanguage(group, 'tr')).toBe(false)
  })

  it('normalizes an untagged legacy chart to the catalog default', () => {
    const normalized = normalizeSongEntry({
      id: 'untagged-song',
      title: 'Untagged Song',
      filename: 'untagged_song.chordpro',
    })
    expect(normalized?.language).toBe('en')
  })
})
