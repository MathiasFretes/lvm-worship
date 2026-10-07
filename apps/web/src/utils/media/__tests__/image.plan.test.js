import { describe, it, expect } from 'vitest'
import { chooseBestLayout, normalizeSongInput } from '../jpgPlanner'
import { planSongForJpg } from '../image'

function makeMockCanvasFactory() {
  return function createCanvas(width = 1, height = 1) {
    const ctx = {
      fillStyle: '#000',
      font: '',
      fillRect: () => {},
      scale: () => {},
      fillText: () => {},
      measureText(text = '') {
        const m = String(this.font || '').match(/(\d+(?:\.\d+)?)px/)
        const pt = m ? Number(m[1]) : 16
        return { width: String(text || '').length * pt * 0.52 }
      },
    }
    return {
      width,
      height,
      getContext: () => ctx,
    }
  }
}

describe('LVM worship-chart image planning', () => {
  it('fits a dense congregational chart on one shareable page after wrapping', () => {
    const createCanvas = makeMockCanvasFactory()
    const measureCtx = createCanvas(1, 1).getContext('2d')
    const makeLyric = (pt) => (text) => {
      measureCtx.font = `${pt}px NotoSans`
      return measureCtx.measureText(text || '').width
    }
    const makeChord = (pt) => (text) => {
      measureCtx.font = `bold ${pt}px NotoSansMono`
      return measureCtx.measureText(text || '').width
    }

    const longLine = 'La mies es mucha y los obreros pocos envíanos Señor a proclamar tu esperanza entre todas las naciones'
    const song = normalizeSongInput({
      title: 'La Voz Misionera',
      key: 'A',
      lyricsBlocks: [
        {
          section: 'ESTROFA 1',
          lines: Array.from({ length: 8 }, () => ({ plain: longLine, chordPositions: [] })),
        },
      ],
    })

    const unwrappedPlan = chooseBestLayout(
      song,
      { lyricFamily: 'NotoSans', chordFamily: 'NotoSansMono' },
      makeLyric,
      makeChord
    )
    expect(unwrappedPlan.plan.layout.pages.length).toBeGreaterThan(1)

    const planned = planSongForJpg(song, {
      createCanvas,
      lyricFamily: 'NotoSans',
      chordFamily: 'NotoSansMono',
    })
    expect(planned.error).toBeUndefined()
    expect(planned.summary).toMatchObject({ pages: 1 })
    expect(planned.plan.layout.pages).toHaveLength(1)
    expect(planned.plan.title).toBe('La Voz Misionera')
  })
})
