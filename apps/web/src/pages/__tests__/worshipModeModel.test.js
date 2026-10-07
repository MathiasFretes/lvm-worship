import { describe, expect, it } from 'vitest'
import { decodeSongIds, initialOffsets, loadWorshipEntries, readWorshipSession, setlistReturnUrl, WORSHIP_SESSION_KEY } from '../worshipModeModel'

const catalog = new Map([
  ['uno', { id: 'uno', title: 'Cántico uno', originalKey: 'C', chordpro_content: '{title: Cántico uno}\n{key: C}\n[C]Señor' }],
  ['dos', { id: 'dos', title: 'Cántico dos', originalKey: 'G', chordpro_content: '{title: Cántico dos}\n{key: G}\n[G]Amén' }],
])

describe('Worship Mode data boundary', () => {
  it('preserves route order and repeated appearances as separate positions', async () => {
    const entries = await loadWorshipEntries(['uno', 'dos', 'uno'], catalog)
    expect(entries.map((entry) => entry.id)).toEqual(['uno', 'dos', 'uno'])
    expect(entries[0]).not.toBe(entries[2])
    expect(entries[0].sections.length).toBeGreaterThan(0)
  })

  it('keeps per-appearance key targets and session recovery separate', async () => {
    const entries = await loadWorshipEntries(['uno', 'dos', 'uno'], catalog)
    const requested = initialOffsets(entries, ['D', 'G', 'E'], '', null)
    expect(requested.base).toEqual([2, 0, 4])
    const recovered = initialOffsets(entries, [], '', { baseOffsets: [0, 0, 0], offsets: [1, 2, 3] })
    expect(recovered.current).toEqual([1, 2, 3])
    expect(setlistReturnUrl(['uno', 'dos', 'uno'], ['D', 'G', 'E'])).toBe('/setlist/uno,dos,uno?toKeys=D,G,E')
  })

  it('rejects a stale or different route session', () => {
    sessionStorage.setItem(WORSHIP_SESSION_KEY, JSON.stringify({ idsString: 'uno,dos', ts: Date.now(), idx: 1 }))
    expect(readWorshipSession(['uno', 'dos'])?.idx).toBe(1)
    expect(readWorshipSession(['dos', 'uno'])).toBeNull()
    sessionStorage.setItem(WORSHIP_SESSION_KEY, JSON.stringify({ idsString: 'uno,dos', ts: 1, idx: 1 }))
    expect(readWorshipSession(['uno', 'dos'])).toBeNull()
    expect(decodeSongIds('uno,dos,uno')).toEqual(['uno', 'dos', 'uno'])
  })
})
