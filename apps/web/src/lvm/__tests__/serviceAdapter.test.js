import { describe, expect, it } from 'vitest'
import fixture from '../../../../../fixtures/sunday-service.json'
import hostileFixture from '../../../../../fixtures/hostile-service.json'
import { fixtureDataSource } from './serviceAdapter.fixture'
import { buildService, buildServiceFromSetlist } from '../serviceAdapter'

describe('LVM service contract', () => {
  it('exports the canonical service without La Voz Misionera fields', async () => {
    const plan = await fixtureDataSource.getServicePlan()
    const songs = await fixtureDataSource.listSongs()
    expect(buildService(plan, songs)).toEqual(fixture)
  })

  it('refuses an incomplete repertory', async () => {
    const plan = await fixtureDataSource.getServicePlan()
    expect(() => buildService(plan, [])).toThrow('Missing song song-1')
  })

  it('exports real ordered entries, repetitions, transposition, and UTF-16 chord positions', () => {
    const song = {
      id: 'senor', dbId: 'uuid-senor', title: 'Señor 😀', originalKey: 'D',
      chordpro_content: '{key: D}\n{start_of_verse: Verso 1}\n[D]Señor 😀 [A]estás aquí\n{end_of_verse}\n{start_of_chorus: Coro}\n[G]Cantaré\n{end_of_chorus}',
    }
    const service = buildServiceFromSetlist({
      id: 'real', name: 'Culto', serviceDate: '2026-09-27T19:00:00-03:00', songs: [song],
      items: [
        { songId: 'uuid-senor', song: { title: song.title }, toKey: 'E', sectionOrderText: '1,2,1,2' },
        { songId: 'uuid-senor', song: { title: song.title }, sectionOrderText: '2,1' },
      ],
    })
    expect(service.items.map((item) => item.id)).toEqual(['song-1', 'song-2'])
    expect(service.items[0].song.sections.map((section) => section.label)).toEqual(['Verso 1', 'Coro', 'Verso 1', 'Coro'])
    expect(service.items[1].song.sections.map((section) => section.label)).toEqual(['Coro', 'Verso 1'])
    expect(service.items[0].song.key).toBe('E')
    const line = service.items[0].song.sections[0].lines[0]
    expect(line.chords[1].index).toBe(line.text.indexOf('estás'))
    expect(line.chords.map((chord) => chord.symbol)).toEqual(['E', 'B'])
  })

  it('keeps the hostile fixture in Service 0.1 with seven section occurrences and two verses', () => {
    expect(hostileFixture.schemaVersion).toBe('0.1')
    expect(hostileFixture.items[0].song.sections.map((section) => section.label)).toEqual([
      'Verso 1', 'Coro', 'Verso 2', 'Coro', 'Puente', 'Coro', 'Coro',
    ])
    expect(hostileFixture.items.filter((item) => item.kind === 'SCRIPTURE')).toHaveLength(2)
    const line = hostileFixture.items[0].song.sections[0].lines[0]
    expect(line.chords[2].index).toBe(line.text.indexOf('estás'))
  })

  it('rejects invalid section numbers and malformed arrangement text', () => {
    const song = { id: 'x', title: 'X', chordpro_content: '{start_of_verse}\n[G]Hola\n{end_of_verse}' }
    const input = { id: 'x', name: 'X', serviceDate: '2026-09-27T19:00:00Z', songs: [song], items: [{ songId: 'x', song: { title: 'X' }, sectionOrderText: '2' }] }
    expect(() => buildServiceFromSetlist(input)).toThrow(/Invalid section order/)
    input.items[0].sectionOrderText = '1,x'
    expect(() => buildServiceFromSetlist(input)).toThrow(/Invalid section order/)
  })
})
