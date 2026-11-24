import { expect, it, vi } from 'vitest'

vi.mock('@react-native-async-storage/async-storage', () => {
  const saved = new Map<string, string>()
  return { default: {
    getItem: async (key: string) => saved.get(key) ?? null,
    setItem: async (key: string, value: string) => { saved.set(key, value) },
  } }
})

import { addSongToServiceDraft, editServiceDraftEntries, exportServiceDraft, readServiceDraft, saveServiceContext } from '../worshipServiceDraft'

it('shares the saved order and each transposed occurrence without a catalog', async () => {
  const user = 'leader'
  const context = { schemaVersion: '0.1', serviceId: 'service-1', title: 'Culto', startsAt: '2026-11-12T20:00:00-03:00', setlistId: 'set-1', name: 'Ensayo' }
  const song = { id: 'alba', title: 'Alba', originalKey: 'D', chordpro_content: '{key:D}\n[D]Sale el sol 😀 [A]hoy' }
  expect(await addSongToServiceDraft(user, song, 'E')).toBeNull()
  await saveServiceContext(user, context)
  await Promise.all([
    addSongToServiceDraft(user, song, 'E'),
    addSongToServiceDraft(user, { ...song, chordpro_content: '[D]Otra versión' }, 'G'),
  ])
  const saved = (await readServiceDraft(user))!
  await editServiceDraftEntries(user, saved.entries[1].id, 'up')
  await saveServiceContext(user, context)
  expect(await readServiceDraft('other-user')).toBeNull()

  const plan = exportServiceDraft((await readServiceDraft(user))!)
  expect(plan.songs.map((item) => [item.songId, item.key])).toEqual([['alba', 'G'], ['alba', 'E']])
  expect(plan.songs[0].sections[0].lines[0].text).toBe('Otra versión')
  const line = plan.songs[1].sections[0].lines[0]
  expect(line.chords).toEqual([{ symbol: 'E', index: 0 }, { symbol: 'B', index: line.text.indexOf('hoy') }])
})
