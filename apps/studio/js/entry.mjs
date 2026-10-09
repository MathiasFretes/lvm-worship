// Bridge entry for the La Voz Misionera Studio JavaScriptCore context.
//
// Imports the chordpro subpath, NOT the '@lavozmisionera/core' barrel: the barrel
// re-exports supabase/client.js, which would pull @supabase/supabase-js — and
// its fetch/WebSocket/storage expectations — into an engine that has none of
// them. chordpro/index.js has zero imports, so this bundle stays dependency-free.
import { stepsBetween as coreStepsBetween, transposeSymPrefer } from '@lavozmisionera/core/chordpro/index.js'
import { formatChord, formatKeyDisplay } from '@lavozmisionera/core/chordpro/solfege.js'
import { parseChordProOrLegacy } from '@lavozmisionera/core/chordpro/parser.ts'
import { lintChordPro } from '@lavozmisionera/core/chordpro/lint.ts'
import { transposeInstrumental } from '@lavozmisionera/core/songs/instrumental.js'
import { hasMinRole as coreHasMinRole, ROLE_ORDER } from '@lavozmisionera/core/rbac/roles.js'
import { slugify as coreSlugify } from '@lavozmisionera/core/songs/slug.ts'
import {
  CHORD_VARIANTS,
  SECTION_PRESETS,
  chordInsertToken,
  insertAtCursor as coreInsertAtCursor,
  wrapSection as coreWrapSection,
} from '@lavozmisionera/core/chordpro/editing.ts'
import { getDiatonicChords } from '@lavozmisionera/core/chordpro/diatonicChords.js'
import { buildSongDraft } from '@lavozmisionera/core/songs/pdfImport.ts'

const CHORD_STYLES = new Set(['letters', 'solfege'])

const rules = {
  string(value) {
    return typeof value === 'string'
  },
  nonEmptyString(value) {
    return typeof value === 'string' && value.length > 0
  },
  integer(value) {
    return typeof value === 'number' && Number.isInteger(value)
  },
  boolean(value) {
    return typeof value === 'boolean'
  },
  style(value) {
    return CHORD_STYLES.has(value)
  },
}

const expectations = {
  string: 'a string',
  nonEmptyString: 'a non-empty string',
  integer: 'an integer',
  boolean: 'a boolean',
  style: `one of ${[...CHORD_STYLES].join('|')}`,
}

function validate(fn, fields) {
  for (const [name, value, rule] of fields) {
    if (!rules[rule](value)) {
      throw new TypeError(`${fn}: ${name} must be ${expectations[rule]}, got ${describe(value)}`)
    }
  }
}

function validateEdit(fn, value, start, end) {
  validate(fn, [['value', value, 'string']])
  for (const [name, offset] of [['start', start], ['end', end]]) {
    if (!rules.integer(offset) || offset < 0) {
      throw new TypeError(`${fn}: ${name} must be a non-negative integer, got ${describe(offset)}`)
    }
  }
  if (start > end) {
    throw new TypeError(`${fn}: start (${start}) must not exceed end (${end})`)
  }
}

function encode(value) {
  return JSON.stringify(value)
}

function transformInstrumental(value, options) {
  return value
    ? transposeInstrumental(value, options.steps, options.preferFlat, { style: options.style })
    : value
}

function transformLine(line, options) {
  if (line.instrumental) {
    line.instrumental = transformInstrumental(line.instrumental, options)
  }
  if (line.chords?.length) {
    line.chords = line.chords.map((chord) => ({
      ...chord,
      sym: formatChord(
        transposeSymPrefer(chord.sym, options.steps, options.preferFlat),
        { style: options.style },
      ),
    }))
  }
}

function transformDocument(doc, options) {
  for (const section of doc.sections ?? []) {
    if (section.instrumental) {
      section.instrumental = transformInstrumental(section.instrumental, options)
    }
    for (const line of section.lines ?? []) {
      transformLine(line, options)
    }
  }
  return doc
}

export function transpose(sym, steps, preferFlat = false) {
  validate('transpose', [
    ['sym', sym, 'nonEmptyString'],
    ['steps', steps, 'integer'],
    ['preferFlat', preferFlat, 'boolean'],
  ])
  return transposeSymPrefer(sym, steps, preferFlat)
}

export function parseToJSON(chordpro) {
  validate('parseToJSON', [['chordpro', chordpro, 'string']])
  return encode(parseChordProOrLegacy(chordpro))
}

export function stepsBetween(fromKey, toKey) {
  validate('stepsBetween', [
    ['fromKey', fromKey, 'nonEmptyString'],
    ['toKey', toKey, 'nonEmptyString'],
  ])
  return coreStepsBetween(fromKey, toKey)
}

export function formatKey(key, style) {
  validate('formatKey', [
    ['key', key, 'nonEmptyString'],
    ['style', style, 'style'],
  ])
  return formatKeyDisplay(key, style)
}

export function renderToJSON(chordpro, steps, preferFlat, style) {
  validate('renderToJSON', [
    ['chordpro', chordpro, 'string'],
    ['steps', steps, 'integer'],
    ['preferFlat', preferFlat, 'boolean'],
    ['style', style, 'style'],
  ])
  return encode(transformDocument(
    parseChordProOrLegacy(chordpro),
    { steps, preferFlat, style },
  ))
}

export function lintToJSON(chordpro) {
  validate('lintToJSON', [['chordpro', chordpro, 'string']])
  return encode(lintChordPro(chordpro))
}

export function hasMinRole(userRole, minRole) {
  validate('hasMinRole', [
    ['userRole', userRole, 'string'],
    ['minRole', minRole, 'nonEmptyString'],
  ])
  return coreHasMinRole(userRole, minRole)
}

export function roleOrderJSON() {
  return encode(ROLE_ORDER)
}

export function slugify(title) {
  validate('slugify', [['title', title, 'string']])
  return coreSlugify(title)
}

// JavaScript string offsets are UTF-16 code units, exactly matching NSRange.
export function insertAtCursorJSON(value, start, end, text) {
  validateEdit('insertAtCursorJSON', value, start, end)
  validate('insertAtCursorJSON', [['text', text, 'string']])
  return encode(coreInsertAtCursor(value, { start, end }, text))
}

export function wrapSectionJSON(value, start, end, directive, label) {
  validateEdit('wrapSectionJSON', value, start, end)
  validate('wrapSectionJSON', [
    ['directive', directive, 'nonEmptyString'],
    ['label', label, 'string'],
  ])
  return encode(coreWrapSection(value, { start, end }, { directive, label }))
}

export function sectionPresetsJSON() {
  return encode(SECTION_PRESETS)
}

export function diatonicChordsJSON(key) {
  validate('diatonicChordsJSON', [['key', key, 'string']])
  return encode(getDiatonicChords(key))
}

export function chordVariantsJSON() {
  return encode(CHORD_VARIANTS)
}

export function chordToken(symbol) {
  validate('chordToken', [['symbol', symbol, 'nonEmptyString']])
  return chordInsertToken(symbol)
}

export function pdfDraftJSON(extractionJSON) {
  validate('pdfDraftJSON', [['extractionJSON', extractionJSON, 'nonEmptyString']])

  let document
  try {
    document = JSON.parse(extractionJSON)
  } catch (error) {
    throw new TypeError(`pdfDraftJSON: extractionJSON is not valid JSON — ${error.message}`)
  }

  if (
    !document ||
    typeof document !== 'object' ||
    !Array.isArray(document.lines) ||
    !Array.isArray(document.pages)
  ) {
    throw new TypeError('pdfDraftJSON: extractionJSON must decode to { lines: [], pages: [] }')
  }
  return encode(buildSongDraft(document))
}

function describe(value) {
  if (value === null) return 'null'
  if (typeof value === 'string') return `'${value}'`
  return `${typeof value} ${String(value)}`
}
