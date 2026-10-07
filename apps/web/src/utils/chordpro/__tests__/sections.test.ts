import { describe, it, expect } from 'vitest';
import { parseChordProOrLegacy } from '../parser';

describe('LVM song-section parsing', () => {
  it.each([
    ['long directives', `
{start_of_verse: Estrofa 1}
[A]Heme aquí
{end_of_verse}
{start_of_chorus}
[B]Envíame
{end_of_chorus}
`, ['verse', 'chorus']],
    ['compact directives', `
{soc}
[C]Coro
{eoc}
{sov}
[D]Estrofa
{eov}
{sob}
[E]Puente
{eob}
`, ['chorus', 'verse', 'bridge']],
  ])('recognizes %s used by the LVM editor', (_format, source, kinds) => {
    const doc = parseChordProOrLegacy(source)
    expect(doc.sections.map(section => section.kind)).toEqual(kinds)
    expect(doc.sections.every(section => section.lines.length > 0)).toBe(true)
  })

  it('imports Spanish plain-text section headers from ministry archives', () => {
    const s = `
Verse 2
[A]Uno
Chorus
[B]Dos
`;
    const doc = parseChordProOrLegacy(s);
    expect(doc.sections.map(section => section.label)).toEqual(
      expect.arrayContaining([expect.stringMatching(/Verse 2/i), expect.stringMatching(/Chorus/i)])
    );
  });

  it('recovers a partially edited chart without dropping its last lyric', () => {
    const s = `
{eoc}
{sov}
[A]La mies es mucha
`;
    const doc = parseChordProOrLegacy(s);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]).toMatchObject({ kind: 'verse' });
    expect(doc.sections[0].lines[0].lyrics).toBe('La mies es mucha');
  });
});
