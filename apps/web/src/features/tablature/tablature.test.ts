import { describe, expect, it } from 'vitest'
import { appendTabMeasure, EMPTY_GUITAR_TAB, getTabMeasure, getTabSystems, replaceTabFret, TAB_EXAMPLE, TAB_MAX_LENGTH, parseTablature } from '@lavozmisionera/core/music/tablature'

describe('text tablature interchange', () => {
  it('retains section names, whitespace and techniques on import and export', () => {
    const source = `Introducción — guitarra\n${TAB_EXAMPLE}\n\nFinal\n${TAB_EXAMPLE.replace('0h2', '2/4')}\n`
    expect(parseTablature(`\uFEFF${source.replaceAll('\n', '\r\n')}`)).toEqual({
      ok: true, source, stringCount: 6, systems: 2,
    })
  })

  it('rejects inconsistent string counts between systems', () => {
    const bass = 'G|--5--|\nD|-----|\nA|-----|\nE|--0--|'
    expect(parseTablature(bass)).toMatchObject({ ok: true, stringCount: 4 })
    expect(parseTablature(`${bass}\n\n${TAB_EXAMPLE}`)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects oversized and corrupt imports', () => {
    expect(parseTablature('x'.repeat(TAB_MAX_LENGTH + 1))).toEqual({ ok: false, reason: 'tooLarge' })
    expect(parseTablature(`\u0000\n${TAB_EXAMPLE}`)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('changes and deletes a two-digit fret without shifting the source columns', () => {
    const source = `🎸 Intro\n${EMPTY_GUITAR_TAB}\n\nOutro\n${TAB_EXAMPLE}`
    const cell = getTabMeasure(getTabSystems(source)[0], 0)[2].cells![3]
    const changed = replaceTabFret(source, cell, '12')!
    expect(changed).toBe(source.replace('G|----------------|', 'G|---12-----------|'))
    expect(replaceTabFret(changed, getTabMeasure(getTabSystems(changed)[0], 0)[2].cells![3], '')).toBe(source)
    expect(replaceTabFret(changed, cell, '15')).toBeNull()
  })

  it('avoids joining adjacent fret numbers and edits the correct measure', () => {
    const source = appendTabMeasure(TAB_EXAMPLE, getTabSystems(TAB_EXAMPLE)[0])!
    const rows = getTabMeasure(getTabSystems(source)[0], 1)
    expect(source.split('\n').every(line => line.endsWith('|----------------|'))).toBe(true)
    expect(replaceTabFret(source, rows[0].cells![15], '12')).toBeNull()
    expect(replaceTabFret(TAB_EXAMPLE, getTabMeasure(getTabSystems(TAB_EXAMPLE)[0], 0)[5].cells![1], '3')).toBeNull()
    expect(replaceTabFret(source, rows[0].cells![0], '12')).toContain('e|----------------|12--------------|')
  })
})
