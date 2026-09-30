import { describe, expect, it } from 'vitest'
import { localSongFromChordPro } from '../localSong'

describe('local ChordPro songs', () => {
  it('loads a song with Spanish title, key and lyrics for offline draft use', () => {
    expect(localSongFromChordPro('senor.cho', '{title: Señor fiel}\n{key: G}\n{start_of_verse}\n[G]Señor\n{end_of_verse}', 'local-1')).toMatchObject({ id: 'local-1', title: 'Señor fiel', originalKey: 'G' })
  })

  it('rejects files without presentable lyrics', () => {
    expect(() => localSongFromChordPro('empty.cho', '{title: Vacía}', 'local-2')).toThrow(/no lyrics/)
  })
})
