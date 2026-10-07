import { describe, it, expect } from 'vitest'
import { convertToCanonicalChordPro, suggestCanonicalFilename } from '../convert'
import { parseChordProOrLegacy } from '../parser'

describe('LVM legacy-chart migration', () => {
  it('turns a ministry chart into canonical, editable ChordPro', () => {
    const source = 'Verse 1\n[A]Enciende una [D]luz\nChorus\n[A]La voz [D]misionera'
    const { text, docTitle } = convertToCanonicalChordPro(source, {
      country: 'Argentina',
      tags: ['misiones', 'congregacional'],
    })
    const doc = parseChordProOrLegacy(text)

    expect(doc.sections.map(section => section.kind)).toEqual(['verse', 'chorus'])
    expect(doc.sections.map(section => section.lines[0].lyrics)).toEqual([
      'Enciende una luz',
      'La voz misionera',
    ])
    expect(doc.meta?.meta).toMatchObject({
      country: 'Argentina',
      tags: 'misiones, congregacional',
    })
    expect(text).toContain('{end_of_chorus}')
    expect(docTitle).toBe('Untitled')
  })

  it.each([
    ['La Voz Misionera', 'la_voz_misionera.chordpro'],
    ['Cristo—Nuestra Esperanza', 'cristo_nuestra_esperanza.chordpro'],
    ['  Santo, Santo!  ', 'santo_santo.chordpro'],
  ])('suggests repository filename %j for %j', (title, filename) => {
    expect(suggestCanonicalFilename(title)).toBe(filename)
  })
})
