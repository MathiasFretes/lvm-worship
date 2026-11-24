import { expect, it } from 'vitest'
import { draftFromWorshipPlan } from '@lavozmisionera/core/setlists/worshipDraft.js'
import { buildWorshipPlanFromSetlist } from '../worshipPlan'
import { buildSongCatalog } from '../../utils/songs/songCatalog'
import { toWorkingItems } from '../../utils/setlists/entries'

const context = { schemaVersion: '0.1', serviceId: 'culto', setlistId: 'set', title: 'Culto', name: 'Alabanza', startsAt: '2026-11-22T19:00:00Z' }
const source = { id: 'canto', title: 'Canción 😀', originalKey: 'D', chordpro_content: '{key: D}\n{start_of_verse: Verso}\n[D]Señor 😀 [A]aquí\n{end_of_verse}\n{start_of_chorus: Coro}\n[G]Cantamos\n{end_of_chorus}' }
const plan = buildWorshipPlanFromSetlist({ context, songs: [source], items: [
  { songId: source.id, toKey: 'E', sectionOrderText: '2,1,2' },
  { songId: source.id, toKey: 'G', sectionOrderText: '1,2' },
] })

it('restores repeated occurrences, performed sections, UTF-16 chord positions and different keys without a catalog', () => {
  const draft = draftFromWorshipPlan(plan, context)
  const songs = draft.entries.map(entry => entry.sourceSong)
  const items = toWorkingItems(draft.entries.map((entry, index) => ({ ...entry, entryKey: `${index}` })), buildSongCatalog(songs))
  const rebuilt = buildWorshipPlanFromSetlist({ context, songs, items })
  expect(rebuilt.songs.map(({ arrangement, ...song }) => song)).toEqual(plan.songs.map(({ arrangement, ...song }) => song))
  expect(rebuilt.songs.map(song => song.arrangement)).toEqual([[1, 2, 3], [1, 2]])
  expect(draft.serviceDate).toBe(context.startsAt)
})

it('rejects a proposal for another scope and refuses lossy ChordPro conversion', () => {
  expect(() => draftFromWorshipPlan(plan, { ...context, serviceId: 'another' })).toThrow(/Invalid/)
  const changed = structuredClone(plan)
  changed.songs[0].sections[0].lines[0].text = 'Literal [C] text'
  expect(() => draftFromWorshipPlan(changed, context)).toThrow(/without changing/)
})
