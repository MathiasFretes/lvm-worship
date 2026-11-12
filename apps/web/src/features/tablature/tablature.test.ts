import { describe, expect, it } from 'vitest'
import { TAB_EXAMPLE, TAB_MAX_LENGTH, parseTablature } from '@lavozmisionera/core/music/tablature'

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
})
