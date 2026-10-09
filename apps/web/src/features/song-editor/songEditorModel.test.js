import { describe, expect, it } from 'vitest'
import { readChordProFile, slugFromTitle, songFormFromRow, songFormToRow, validateSongForm, youtubeId } from './songEditorModel'
import { toSong } from '../../lvm/serviceAdapter'

describe('LVM song editor model', () => {
  it('keeps ChordPro sections and chords unchanged while mapping a song', () => {
    const body = '{start_of_verse: Verso 1}\n[G]Niño de Belén\n{end_of_verse}'
    const form = songFormFromRow({ title: 'Niño de Belén', tags: [' Navidad '], chordpro_content: body })
    expect(songFormToRow(form)).toMatchObject({
      title: 'Niño de Belén',
      tags: ['Navidad'],
      chordpro_content: body,
    })
    const presented = toSong({ id: 'nino', title: form.title, originalKey: 'G', chordpro_content: songFormToRow(form).chordpro_content })
    expect(presented.sections[0].lines[0]).toMatchObject({ text: 'Niño de Belén', chords: [{ symbol: 'G', index: 0 }] })
  })

  it('requires title, key and a meaningful tag', () => {
    expect(validateSongForm({ title: ' ', default_key: '', tags: [' '] })).toEqual({
      title: 'Title is required',
      default_key: 'Key is required',
      tags: 'At least one tag is required',
    })
    expect(validateSongForm({ title: 'Santo', default_key: 'G', tags: ['Adoración'] })).toEqual({})
  })

  it('builds stable slugs from accented and non-Latin titles', () => {
    expect(slugFromTitle('Niño de Belén')).toBe('nino_de_belen')
    expect(slugFromTitle('찬양')).toBe('찬양')
  })

  it('validates tempo and YouTube input before saving', () => {
    expect(validateSongForm({ title: 'Santo', default_key: 'G', tags: ['Worship'], tempo: 'abc', youtube_id: 'not a video' })).toMatchObject({
      tempo: 'Tempo must be between 20 and 400 BPM',
      youtube_id: 'Enter a valid YouTube ID or URL',
    })
    expect(youtubeId('https://youtu.be/abcdefghijk')).toBe('abcdefghijk')
  })

  it('imports song metadata while retaining ChordPro sections and chords', () => {
    const imported = readChordProFile('{title: Cantaré}\n{artist: Equipo LVM}\n{key: G}\n{tags: Alabanza, Culto}\n{start_of_chorus: Coro}\n[G]Cantaré\n{end_of_chorus}')
    expect(imported).toMatchObject({ title: 'Cantaré', artist: 'Equipo LVM', default_key: 'G', tags: ['Alabanza', 'Culto'] })
    expect(toSong({ id: 'cantare', title: imported.title, originalKey: imported.default_key, chordpro_content: imported.chordpro_content }).sections[0].lines[0].chords).toEqual([{ symbol: 'G', index: 0 }])
  })
})
