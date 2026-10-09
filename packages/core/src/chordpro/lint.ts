import { parseChordProOrLegacy } from './parser'
import type { SongDoc } from './types'

export type LintWarning = { code: string; message: string; sectionIndex?: number; lineIndex?: number }

const RX_CHORD_VALID = /^[A-G](?:#|b)?(?:(?:maj|min|m|dim|sus|add)?\d*)?(?:\/[A-G](?:#|b)?)?$/

export function lintChordPro(rawOrDoc: string | SongDoc): LintWarning[] {
  const doc: SongDoc = typeof rawOrDoc === 'string' ? parseChordProOrLegacy(rawOrDoc) : rawOrDoc
  const warnings: LintWarning[] = []

  if (!doc.meta?.title || !doc.meta.title.trim()) {
    warnings.push({ code: 'warn:missing_title', message: 'Missing {title}.' })
  }
  if (!doc.meta?.key || !doc.meta.key.trim()) {
    warnings.push({ code: 'warn:missing_key', message: 'Missing {key}.' })
  }

  for (const [si, sec] of doc.sections.entries()) {
    const lyricLines = sec.lines.filter((line) => line.comment === undefined)
    if (lyricLines.length === 0) {
      warnings.push({ code: 'warn:empty_section', message: `Section "${sec.label || sec.kind}" has no lyric lines.`, sectionIndex: si })
    }
    for (const [li, ln] of lyricLines.entries()) {
      if ((ln.lyrics || '').length > 90) {
        warnings.push({ code: 'warn:long_line', message: 'Very long lyric line may force downsizing.', sectionIndex: si, lineIndex: li })
      }
      for (const ch of ln.chords || []) {
        if (!RX_CHORD_VALID.test(ch.sym)) {
          warnings.push({ code: 'warn:unknown_chord', message: `Suspicious chord "${ch.sym}".`, sectionIndex: si, lineIndex: li })
        }
      }
    }
  }

  for (let i = 1; i < doc.sections.length; i++) {
    const a = doc.sections[i - 1]
    const b = doc.sections[i]
    if ((a.label || a.kind) === (b.label || b.kind)) {
      const aLen = a.lines.filter(ln => !('comment' in ln)).length
      const bLen = b.lines.filter(ln => !('comment' in ln)).length
      if (aLen <= 2 && bLen <= 2) {
        warnings.push({ code: 'warn:duplicate_section_header', message: `Adjacent duplicate "${a.label || a.kind}" with very few lines.`, sectionIndex: i })
      }
    }
  }

  if (typeof rawOrDoc === 'string') {
    const lines = rawOrDoc.split(/\r?\n/)
    const stack: { kind: string; lineIndex: number }[] = []
    for (const [idx, raw] of lines.entries()) {
      const m = raw.trim().match(/^\{(start_of|end_of)_([^}:]+).*\}$/i)
      if (m) {
        const type = m[1].toLowerCase()
        const kind = m[2].toLowerCase()
        if (type === 'start_of') {
          stack.push({ kind, lineIndex: idx })
        } else {
          const expected = stack.pop()
          if (!expected || expected.kind !== kind) {
            warnings.push({ code: 'warn:section_mismatch', message: `Stray {end_of_${kind}}`, lineIndex: idx })
          }
        }
      }
    }
    for (const item of stack) {
      warnings.push({ code: 'warn:section_mismatch', message: `Unclosed {start_of_${item.kind}}`, lineIndex: item.lineIndex })
    }
  }

  return warnings
}
