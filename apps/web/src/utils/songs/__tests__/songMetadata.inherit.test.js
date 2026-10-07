import { describe, it, expect } from 'vitest'
import { inheritTranslationMetadata } from '../songMetadata'

describe('LVM translation metadata policy', () => {
  it('fills an incomplete translation from its English ministry master', () => {
    const items = [
      {
        id: 'send-us-lord-en',
        songId: 'send-us-lord',
        language: 'en',
        originalKey: 'A',
        tags: ['Missions'],
        authors: ['La Voz Misionera'],
        country: 'Argentina',
        youtube: 'https://youtu.be/abcdefghijk',
        mp3: 'https://cdn.example.com/send-us-lord.mp3',
      },
      {
        id: 'send-us-lord-tr',
        songId: 'send-us-lord',
        language: 'tr',
        originalKey: '',
        tags: [],
        authors: [],
        country: '',
        youtube: '',
        mp3: '',
        _metaPresence: {
          key: false,
          tags: false,
          authors: false,
          country: false,
          youtube: false,
          mp3: false,
          pptx: false,
        },
      },
    ]

    inheritTranslationMetadata(items)
    const tr = items.find((s) => s.id === 'send-us-lord-tr')
    expect(tr.originalKey).toBe('A')
    expect(tr.tags).toEqual(['Missions'])
    expect(tr.authors).toEqual(['La Voz Misionera'])
    expect(tr.country).toBe('Argentina')
    expect(tr.youtube).toBe('https://youtu.be/abcdefghijk')
    expect(tr.mp3).toBe('https://cdn.example.com/send-us-lord.mp3')
  })

  it('treats an explicitly blank media field as inheritable', () => {
    const items = [
      {
        id: 'song-en',
        songId: 'song-id',
        language: 'en',
        originalKey: 'G',
        youtube: 'https://youtu.be/abcdefghijk',
      },
      {
        id: 'song-tr',
        songId: 'song-id',
        language: 'tr',
        originalKey: '',
        youtube: '',
        _metaPresence: {
          key: false,
          tags: false,
          authors: false,
          country: false,
          youtube: true,
          mp3: false,
          pptx: false,
        },
      },
    ]

    inheritTranslationMetadata(items)
    const tr = items.find((s) => s.id === 'song-tr')
    expect(tr.youtube).toBe('https://youtu.be/abcdefghijk')
  })

  it('preserves a translation-specific media override', () => {
    const items = [
      {
        id: 'song-en',
        songId: 'song-id',
        language: 'en',
        youtube: 'https://youtu.be/abcdefghijk',
      },
      {
        id: 'song-tr',
        songId: 'song-id',
        language: 'tr',
        youtube: 'https://youtu.be/zzzzzzzzzzz',
        _metaPresence: {
          key: false,
          tags: false,
          authors: false,
          country: false,
          youtube: true,
          mp3: false,
          pptx: false,
        },
      },
    ]

    inheritTranslationMetadata(items)
    const tr = items.find((s) => s.id === 'song-tr')
    expect(tr.youtube).toBe('https://youtu.be/zzzzzzzzzzz')
  })
})
