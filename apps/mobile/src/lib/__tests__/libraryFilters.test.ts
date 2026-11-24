import { describe, expect, it } from 'vitest'
import { availableLibraryKeys, EMPTY_LIBRARY_FILTERS, matchesLibraryFilters, validLibraryRange } from '../../../../../packages/core/src/songs/libraryFilters'

describe('shared library musical filters', () => {
  it('combines key, inclusive tempo boundaries and personal source on both catalog shapes', () => {
    const filters = { ...EMPTY_LIBRARY_FILTERS, key: 'F♯m', minBpm: '80', maxBpm: '120', source: 'personal' as const }
    expect(matchesLibraryFilters({ default_key: 'F#m', tempo: 80, source: 'personal' }, filters)).toBe(true)
    expect(matchesLibraryFilters({ originalKey: 'F#m', tempo: 120, isPersonal: true }, filters)).toBe(true)
    expect(matchesLibraryFilters({ originalKey: 'F#', tempo: 100, isPersonal: true }, filters)).toBe(false)
    expect(matchesLibraryFilters({ originalKey: 'F#m', tempo: 121, isPersonal: true }, filters)).toBe(false)
    expect(matchesLibraryFilters({ originalKey: 'F#m', tempo: 100 }, filters)).toBe(false)
  })

  it('includes unknown tempo only when the tempo range is empty', () => {
    for (const tempo of [null, undefined, NaN, Infinity]) {
      expect(matchesLibraryFilters({ tempo }, EMPTY_LIBRARY_FILTERS)).toBe(true)
      expect(matchesLibraryFilters({ tempo }, { ...EMPTY_LIBRARY_FILTERS, maxBpm: '110' })).toBe(false)
    }
  })

  it('rejects inverted, fractional, signed and malformed ranges instead of treating them as unrestricted', () => {
    for (const [minBpm, maxBpm] of [['120', '80'], ['0', ''], ['1.5', ''], ['-10', ''], ['abc', ''], ['', '1000']]) {
      const filters = { ...EMPTY_LIBRARY_FILTERS, minBpm, maxBpm }
      expect(validLibraryRange(filters)).toBe(false)
      expect(matchesLibraryFilters({ tempo: 100 }, filters)).toBe(false)
    }
    expect(validLibraryRange({ minBpm: ' 80 ', maxBpm: '80' })).toBe(true)
  })

  it('uses actual keys, merges notation variants and leaves major and minor distinct', () => {
    expect(availableLibraryKeys([{ originalKey: 'Bb' }, { default_key: 'B♭' }, { default_key: 'Bbm' }, { originalKey: '' }])).toEqual(['Bb', 'Bbm'])
    expect(matchesLibraryFilters({ source: 'personal' }, { ...EMPTY_LIBRARY_FILTERS, source: 'catalog' })).toBe(false)
  })
})
