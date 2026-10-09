import { describe, it, expect } from 'vitest'
import { renderPlanToCanvas } from '../image'

describe('LVM multilingual chart rendering', () => {
  it('draws every Turkish ministry glyph without transliteration', () => {
    const drawn = []
    const ctx = {
      fillStyle: '#000',
      font: '',
      fillRect: () => {},
      scale: () => {},
      fillText: (text) => drawn.push(String(text)),
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
    }

    const plan = {
      margin: 36,
      lyricSizePt: 16,
      chordSizePt: 16,
      lyricFamily: 'NotoSans',
      chordFamily: 'NotoSansMono',
      title: 'Bizi Gönder',
      key: 'A',
      columns: 1,
      headerOffsetY: 0,
      layout: {
        pages: [
          {
            columns: [
              {
                x: 36,
                blocks: [
                  { type: 'section', header: 'Köprü' },
                  { type: 'line', lyrics: 'IĞDIR İÇİN ÖĞÜT', chords: [{ sym: 'A', x: 0 }] },
                  { type: 'line', lyrics: 'ıüşiçöğ IÜŞİÇÖĞ', chords: [] },
                ],
              },
            ],
          },
        ],
      },
    }

    renderPlanToCanvas(plan, {
      pxWidth: 1200,
      pxHeight: 1600,
      dpi: 150,
      createCanvas: () => canvas,
    })

    expect(drawn).toEqual(expect.arrayContaining([
      'Bizi Gönder',
      '[Köprü]',
      'IĞDIR İÇİN ÖĞÜT',
      'ıüşiçöğ IÜŞİÇÖĞ',
    ]))
    expect(drawn.some(text => text.includes('A'))).toBe(true)
  })
})
