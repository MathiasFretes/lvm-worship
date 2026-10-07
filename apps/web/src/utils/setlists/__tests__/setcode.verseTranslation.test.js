import { describe, expect, it } from 'vitest'
import { decodeSet, encodeSet } from '../setcode'
import { parseVerseReference } from '../../songs/verseRef'

describe('LVM set-code Scripture entries', () => {
  it.each([
    ['John 3:16', 'kjv'],
    ['Matthew 28:19-20', 'esv'],
    ['Acts 1:8', 'rvr1960'],
  ])('round-trips %s in %s for a worship plan', (reference, translation) => {
    const parsed = parseVerseReference(reference, { translation })
    const code = encodeSet([], [{ id: parsed.id, toKey: '' }])
    const decoded = decodeSet([], code)

    expect(code).toMatch(/^V_/)
    expect(decoded.error).toBeUndefined()
    expect(decoded.entries).toEqual([
      { id: `v:${translation}|${reference}`, toKey: '' },
    ])
  })

  it('opens a legacy verse entry using the historical ESV default', () => {
    const legacy = `V${encodeLegacyVerse('John', '3:16')}`
    const decoded = decodeSet([], legacy)
    expect(decoded.error).toBeUndefined()
    expect(decoded.entries).toEqual([{ id: 'v:esv|John 3:16', toKey: '' }])
  })
})

function encodeLegacyVerse(book, refKey){
  const encodedBook = encodeLegacyString(book)
  const encodedRef = encodeLegacyString(refKey.replace(/,/g, '~'))
  return `${toBase36(encodedBook.length, 2)}${encodedBook}${toBase36(encodedRef.length, 3)}${encodedRef}`
}

function encodeLegacyString(value){
  return String(value || '').replace(/-/g, '--').replace(/~/g, '-t').replace(/%/g, '-p')
}

function toBase36(num, width){
  return Number(num || 0).toString(36).toUpperCase().padStart(width, '0')
}
