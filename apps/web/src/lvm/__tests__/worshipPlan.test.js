import { describe, expect, it } from 'vitest'
import { buildWorshipPlanFromSetlist, parseWorshipContext } from '../worshipPlan'

const context = { schemaVersion: '0.1', serviceId: 'culto-1', title: 'Culto', startsAt: '2026-10-04T19:00:00Z', setlistId: 'set-1', name: 'Adoración' }
const source = { id: 'senor', title: 'Señor 😀', originalKey: 'D', chordpro_content: '{key: D}\n{start_of_verse: Verso}\n[D]Señor 😀 [A]estás aquí\n{end_of_verse}\n{start_of_chorus: Coro}\n[G]Cantaré\n{end_of_chorus}' }

describe('WorshipPlan 0.1', () => {
  it('exports repeated song occurrences, arrangement, accents, transposition, and chord offsets', () => {
    const plan = buildWorshipPlanFromSetlist({ context, songs: [source], items: [
      { songId: 'senor', song: { title: source.title }, toKey: 'E', sectionOrderText: '1,2,1,2' },
      { songId: 'senor', song: { title: source.title }, toKey: 'D', sectionOrderText: '2,1' },
    ] })
    expect(plan).toMatchObject({ schemaVersion: '0.1', serviceId: 'culto-1', songs: [{ songId: 'senor', key: 'E', arrangement: [1, 2, 1, 2] }, { songId: 'senor', arrangement: [2, 1] }] })
    expect(plan.songs[0].sections.map((section) => section.label)).toEqual(['Verso', 'Coro', 'Verso', 'Coro'])
    const line = plan.songs[0].sections[0].lines[0]
    expect(line.chords[1].index).toBe(line.text.indexOf('estás'))
    expect(line.chords.map((chord) => chord.symbol)).toEqual(['E', 'B'])
  })

  it('rejects unrelated fields and nonmusic', () => {
    expect(() => parseWorshipContext({ ...context, sermon: {} })).toThrow(/unknown field/)
    expect(() => parseWorshipContext({ ...context, schemaVersion: '0.2' })).toThrow(/schemaVersion/)
    expect(() => buildWorshipPlanFromSetlist({ context, songs: [source], items: [{ songId: 'v:1', song: { verse: true } }] })).toThrow(/solo admite canciones/)
  })
})
