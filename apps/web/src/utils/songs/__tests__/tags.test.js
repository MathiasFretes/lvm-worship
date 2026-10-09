import { describe, expect, it } from 'vitest'
import {
  buildTagMap,
  canonicalizeTags,
  filterDisplayTags,
  normalizeTagKey,
  tagLabelFromKey,
} from '../tags'

describe('LVM ministry tag vocabulary', () => {
  it.each([
    ['  MISIONES  ', 'misiones'],
    ['Adoración Congregacional', 'adoración congregacional'],
    ['  HYmN  ', 'hymn'],
  ])('normalizes %j to catalog key %j', (raw, key) => {
    expect(normalizeTagKey(raw)).toBe(key)
  })

  it.each([
    ['misiones', 'Misiones'],
    ['hymn', 'Hymn'],
    ['icp', 'ICP'],
  ])('labels %j as %j', (key, label) => {
    expect(tagLabelFromKey(key)).toBe(label)
  })

  it('deduplicates editor input while hiding internal catalog markers', () => {
    const map = buildTagMap([{ tags: ['MISIONES', 'misiones', 'ICP', 'icp'] }])
    const normalized = canonicalizeTags(['Misiones', 'MISIONES', 'icp'], map)

    expect(normalized).toEqual({
      keys: ['misiones', 'icp'],
      labels: ['Misiones', 'ICP'],
    })
    expect(filterDisplayTags(normalized.labels)).toEqual(['Misiones'])
  })
})

