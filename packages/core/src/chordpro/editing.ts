// Pure ChordPro text-editing helpers shared by the web and mobile editors.
//
// These take the current textarea value + selection and return the next value +
// selection, with no DOM access — the web ChordProEditor and the RN ChordProInput
// wrap them with their platform-specific ref/selection glue. Keeping the string
// math here means both editors insert chords and wrap sections identically.

export type Selection = { start: number; end: number }
export type EditResult = { value: string; selection: Selection }

function replaceSelection(
  value: string,
  selection: Selection,
  replacement: string,
  nextSelection: Selection,
): EditResult {
  return {
    value: value.slice(0, selection.start) + replacement + value.slice(selection.end),
    selection: nextSelection,
  }
}

/** Insert `text` at the current caret, replacing any selected range. */
export function insertAtCursor(value: string, selection: Selection, text: string): EditResult {
  const caret = selection.start + text.length
  return replaceSelection(value, selection, text, { start: caret, end: caret })
}

/**
 * Wrap the current selection in a `{start_of_<directive>: <label>}` …
 * `{end_of_<directive>}` block. With no selection, insert an empty block and
 * place the caret on the (blank) content line. Mirrors the web wrapSelection.
 */
export function wrapSection(
  value: string,
  selection: Selection,
  { directive, label }: { directive: string; label: string },
): EditResult {
  const { start, end } = selection
  const startDir = `{start_of_${directive}: ${label}}`
  const endDir = `{end_of_${directive}}`
  const selected = value.slice(start, end)

  if (selected) {
    const insertion = `${startDir}\n${selected}\n${endDir}\n`
    return replaceSelection(value, selection, insertion, {
      start,
      end: start + insertion.length,
    })
  }

  const insertion = `${startDir}\n\n${endDir}\n`
  const pos = start + startDir.length + 1 // caret on the blank content line
  return replaceSelection(value, selection, insertion, { start: pos, end: pos })
}

export const CHORD_VARIANTS = ['7', 'maj7', 'sus2', 'sus4'] as const

/** Token inserted for a diatonic chord button tap, e.g. "G" → "[G]". */
export function chordInsertToken(symbol: string): string {
  return `[${symbol}]`
}

export type SectionPreset = {
  /** UI button text. */
  label: string
  /** Parser-supported section environment this maps to. */
  directive: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'tag'
  /** Label emitted after the colon, e.g. `{start_of_chorus: Pre-Chorus}`. */
  sectionLabel: string
}

// The parser only accepts these long-form section environments
// (verse|chorus|bridge|intro|tag|outro). Anything else — including the old
// `pre_chorus`/`interlude` directives the web bar used to emit — is silently
// dropped by the parser, so those become NAMED choruses instead (Ryan's
// convention: a Pre-Chorus is `{start_of_chorus: Pre-Chorus}`).
const PRESET_SPECS = [
  { label: 'Verse', directive: 'verse', sectionLabel: 'Verse' },
  { label: 'Chorus', directive: 'chorus', sectionLabel: 'Chorus' },
  { label: 'Bridge', directive: 'bridge', sectionLabel: 'Bridge' },
  { label: 'Pre-Chorus', directive: 'chorus', sectionLabel: 'Pre-Chorus' },
  { label: 'Intro', directive: 'intro', sectionLabel: 'Intro' },
  { label: 'Outro', directive: 'outro', sectionLabel: 'Outro' },
  { label: 'Tag', directive: 'tag', sectionLabel: 'Tag' },
  { label: 'Interlude', directive: 'chorus', sectionLabel: 'Interlude' },
] satisfies SectionPreset[]

export const SECTION_PRESETS: readonly SectionPreset[] = Object.freeze(PRESET_SPECS)
