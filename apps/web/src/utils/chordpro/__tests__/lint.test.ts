import { describe, it, expect } from 'vitest'
import { lintChordPro } from '../lint'

describe('LVM chart authoring diagnostics', () => {
  it.each([
    [
      'an imported chart missing metadata with an overlong projection line',
      `{start_of_verse}\n[A]${'aleluya '.repeat(20)}\n{end_of_verse}`,
      ['warn:missing_title', 'warn:missing_key', 'warn:long_line'],
    ],
    [
      'a chart with a mistyped chord',
      '{title: Envíame}\n{key: A}\n{start_of_verse}\n[H]Heme aquí\n{end_of_verse}',
      ['warn:unknown_chord'],
    ],
    [
      'an empty chorus left by an editor',
      '{title: Envíame}\n{key: A}\n{start_of_chorus}\n{end_of_chorus}',
      ['warn:empty_section'],
    ],
  ])('reports actionable warnings for %s', (_scenario, source, expectedCodes) => {
    const codes = lintChordPro(source).map(warning => warning.code)
    for (const code of expectedCodes) expect(codes).toContain(code)
  })
})
