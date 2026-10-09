import { describe, expect, it } from 'vitest'
import {
  makeVerseId,
  parseVerseId,
  parseVerseReference,
} from '../verseRef'

describe('LVM Scripture-entry identity', () => {
  it.each([
    [{ book: 'John', refKey: '3:16' }, 'v:esv|John 3:16'],
    [{ book: 'Matthew', refKey: '28:19-20', translation: 'KJV' }, 'v:kjv|Matthew 28:19-20'],
    [{ book: 'Acts', refKey: '1:8', translation: 'RVR1960' }, 'v:rvr1960|Acts 1:8'],
  ])('creates stable translation-aware id %j', (verse, expected) => {
    expect(makeVerseId(verse)).toBe(expected)
  })

  it('restores translation and display text from a current id', () => {
    const parsed = parseVerseId('v:tr|John 3:16')
    expect(parsed?.translation).toBe('tr')
    expect(parsed?.refDisplay).toBe('John 3:16')
  })

  it('upgrades a legacy setlist id to the historical ESV default', () => {
    const parsed = parseVerseId('v:John 3:16')
    expect(parsed?.translation).toBe('esv')
    expect(parsed?.id).toBe('v:esv|John 3:16')
  })

  it('attaches the team-selected translation to typed Scripture', () => {
    const parsed = parseVerseReference('Matthew 28:19-20', { translation: 'RVR1960' })
    expect(parsed.error).toBeUndefined()
    expect(parsed.translation).toBe('rvr1960')
    expect(parsed.id).toBe('v:rvr1960|Matthew 28:19-20')
  })

  it('keeps multi-chapter reading-plan groups intact', () => {
    const parsed = parseVerseReference('Jeremiah 36&45')
    expect(parsed.error).toBeUndefined()
    expect(parsed.segments).toEqual([
      { chapter: 36, ranges: null },
      { chapter: 45, ranges: null },
    ])
  })
})
