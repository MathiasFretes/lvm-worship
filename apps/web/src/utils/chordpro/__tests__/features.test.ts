import { describe, it, expect } from 'vitest';
import { parseChordProOrLegacy } from '../parser';
import { serializeChordPro } from '../serialize';

const ministryChart = `
{title: Envíame}
{key: Am}
{capo: 3}
{columns: 2}
{define: G 320003 23xxxx}

{start_of_verse: Estrofa 1}
{c: Suave}
[Am]Heme aquí...
{end_of_verse}
{column_break}
{start_of_chorus}
[C]Envíame...
{end_of_chorus}
`;

describe('LVM extended ChordPro contract', () => {
  it('retains musician-facing layout directives during an edit round trip', () => {
    const doc = parseChordProOrLegacy(ministryChart);
    expect(doc.meta.capo).toBe(3);
    expect(doc.layoutHints?.requestedColumns).toBe(2);
    expect(doc.chordDefs?.length).toBeGreaterThan(0);
    const out = serializeChordPro(doc);
    for (const directive of [
      /\{capo:\s*3\}/,
      /\{columns:\s*2\}/,
      /\{c:\s*Suave\}/i,
      /\{define:\s*G\s+/i,
      /\{column_break\}/,
    ]) expect(out).toMatch(directive);
  });

  it('separates cues and instrumental passages from sung sections', () => {
    const src = `
{title: La cosecha}
{start_of_verse: Estrofa 1}
Antes del instrumental
{inst D, A, E}
Después del instrumental
{end_of_verse}
{com Suave}
{i: Em, D, Am7, Bm7 x2}
`;

    const doc = parseChordProOrLegacy(src);
    expect(doc.sections.length).toBeGreaterThanOrEqual(4);

    const [first, second, third, fourth] = doc.sections;
    expect(first.kind).toBe('verse');
    expect(first.lines[0]?.lyrics).toBe('Antes del instrumental');

    expect(second.kind).toBe('instrumental');
    expect(second.instrumental?.chords).toEqual(['D', 'A', 'E']);
    expect(second.lines[0]?.instrumental?.repeat).toBeUndefined();

    expect(third.kind).toBe('verse');
    expect(third.lines[0]?.lyrics).toBe('Después del instrumental');

    const commentSec = doc.sections.find(sec => sec.kind === 'comment');
    expect(commentSec?.lines?.[0]?.comment).toBe('Suave');

    const instSections = doc.sections.filter(sec => sec.kind === 'instrumental');
    expect(instSections).toHaveLength(2);
    const lastInst = instSections[instSections.length - 1];
    expect(lastInst.instrumental?.chords).toEqual(['Em', 'D', 'Am7', 'Bm7']);
    expect(lastInst.instrumental?.repeat).toBe(2);
  });

  it('keeps a service-opening instrumental before the first lyric', () => {
    const src = `
{title: Heme aquí}
{inst Em, D, Am7, Bm7 x2}
{sov Estrofa 1}
[Em]Heme aquí
{eov}
`;
    const doc = parseChordProOrLegacy(src);
    expect(doc.sections[0]?.kind).toBe('instrumental');
    const instLine = doc.sections[0]?.lines?.[0];
    expect(instLine?.instrumental?.chords).toEqual(['Em', 'D', 'Am7', 'Bm7']);
    expect(instLine?.instrumental?.repeat).toBe(2);
    expect(doc.sections[1]?.kind).toBe('verse');

    const blocks = (doc.sections || []).map((sec) => ({
      section: sec.label,
      lines: (sec.lines || []).map((ln) => ({
        instrumental: ln.instrumental,
        comment: ln.comment,
      })),
    }));
    expect(blocks[0]?.lines?.[0]?.instrumental?.chords).toEqual(['Em', 'D', 'Am7', 'Bm7']);
  });
});
