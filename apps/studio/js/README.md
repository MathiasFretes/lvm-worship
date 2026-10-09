# Studio ↔ `packages/core` JS bridge

La Voz Misionera Studio is native macOS SwiftUI, but it reuses `packages/core`'s logic
instead of reimplementing it in Swift (where it would drift from the JS that web
and mobile depend on). Core is bundled into one flat file and run inside a
JavaScriptCore `JSContext`.

## Files

| File | Role |
|------|------|
| `entry.mjs` | Bridge entry. Imports core **subpaths** (never the barrel), validates arguments, exports the functions in the table below. |
| `build-core-bundle.mjs` | esbuild build → `La Voz Misionera Studio/La Voz Misionera Studio/Resources/LaVozMisioneraCore.js` |
| `verify-bundle.mjs` | Parity harness: generated bundle vs. current `packages/core` sources. |
| `pdf-draft.mjs` | Runs saved positioned-text JSON through the current core importer. |

Exposed to Swift:

| JS | Swift | Core function |
|----|-------|---------------|
| `LaVozMisioneraCore.transpose(sym, steps, preferFlat)` | `CoreBridge.transpose(_:steps:preferFlat:)` | `chordpro/index.js` → `transposeSymPrefer` |
| `LaVozMisioneraCore.parseToJSON(text)` | `CoreBridge.parse(_:) -> SongDoc` | `chordpro/parser.ts` → `parseChordProOrLegacy` |
| `LaVozMisioneraCore.renderToJSON(text, steps, preferFlat, style)` | `CoreBridge.render(_:steps:preferFlat:style:)` | composition of the above + `songs/instrumental.js` |
| `LaVozMisioneraCore.stepsBetween(from, to)` | `CoreBridge.stepsBetween(from:to:)` | `chordpro/index.js` → `stepsBetween` |
| `LaVozMisioneraCore.formatKey(key, style)` | `CoreBridge.formatKey(_:style:)` | `chordpro/solfege.js` → `formatKeyDisplay` |
| `LaVozMisioneraCore.lintToJSON(text)` | `CoreBridge.lint(_:) -> [LintWarning]` | `chordpro/lint.ts` → `lintChordPro` |
| `LaVozMisioneraCore.hasMinRole(role, min)` | `CoreBridge.hasMinRole(_:atLeast:)` | `rbac/roles.js` → `hasMinRole` |
| `LaVozMisioneraCore.roleOrderJSON()` | *(parity harness only)* | `rbac/roles.js` → `ROLE_ORDER` |
| `LaVozMisioneraCore.slugify(title)` | `CoreBridge.slugify(_:)` | `songs/slug.ts` → `slugify` |
| `LaVozMisioneraCore.insertAtCursorJSON(value, start, end, text)` | `CoreBridge.insertAtCursor(in:start:end:text:)` | `chordpro/editing.ts` → `insertAtCursor` |
| `LaVozMisioneraCore.wrapSectionJSON(value, start, end, directive, label)` | `CoreBridge.wrapSection(in:start:end:directive:label:)` | `chordpro/editing.ts` → `wrapSection` |
| `LaVozMisioneraCore.sectionPresetsJSON()` | `CoreBridge.sectionPresets()` | `chordpro/editing.ts` → `SECTION_PRESETS` |
| `LaVozMisioneraCore.diatonicChordsJSON(key)` | `CoreBridge.diatonicChords(for:)` | `chordpro/diatonicChords.js` → `getDiatonicChords` |
| `LaVozMisioneraCore.chordVariantsJSON()` | `CoreBridge.chordVariants()` | `chordpro/editing.ts` → `CHORD_VARIANTS` |
| `LaVozMisioneraCore.chordToken(symbol)` | `CoreBridge.chordToken(_:)` | `chordpro/editing.ts` → `chordInsertToken` |

The editing helpers take and return **UTF-16 offsets**, because that is what a JS
string index is. Swift's native `String.Index` arithmetic counts *Characters*, so the
two disagree the moment a lyric leaves ASCII — and the catalog has Turkish and Korean
songs. `Core/ChordProEditing.swift` does the conversion at the boundary and the parity
harness covers Turkish, Korean and an emoji surrogate pair specifically.

`hasMinRole` and `slugify` are bridged rather than ported for the same reason as the
parser: both have outputs that must match another client exactly. A Swift copy of
`ROLE_ORDER` is precisely the thing that outlives a hierarchy change unnoticed
(`collaborator` was removed from it in 2026-07), and a Swift slug regex that differed
from core's by one character class would mint URLs no other client produces.

`lintChordPro` returns **warnings only** — every code is prefixed `warn:` and there is
no severity field. Studio was its first consumer; before Phase 3 the function was
referenced by one web test and no UI.

`parseToJSON` returns the whole `SongDoc` as a JSON string so Swift decodes it in
one `JSONDecoder` step instead of walking a `JSValue` tree; the Swift mirrors of
`chordpro/types.ts` live in `Core/SongDoc.swift`.

Swift side: `La Voz Misionera Studio/La Voz Misionera Studio/Core/CoreBridge.swift`.

## Rebuilding the bundle

Run from the repo root, after changing `entry.mjs` or one of its imported
`packages/core` modules:

```powershell
node "apps/studio/js/build-core-bundle.mjs"
node "apps/studio/js/verify-bundle.mjs"
```

Success ends with `ALL CHECKS PASSED`. The generated resource is committed; Node
is a maintenance dependency, not a runtime dependency of Studio.

## Bundle format

`--bundle --format=iife --global-name=LaVozMisioneraCore --platform=neutral
--target=safari17`, so `JSContext.evaluateScript` leaves a `LaVozMisioneraCore`
object on the context's global. `JSContext` has no CommonJS/ESM loader, so an
IIFE that self-assigns is the format that needs no shim.

## Do not import the `@lavozmisionera/core` barrel here

`packages/core/src/index.ts` re-exports `supabase/client.js`, which pulls in
`@supabase/supabase-js` and its `fetch`/WebSocket/storage expectations — none of
which exist in a bare `JSContext`. Always import the narrowest subpath
(`@lavozmisionera/core/<dir>/<file>`, which the package's `"./*": "./src/*"` exports
pattern resolves). The build script prints its module list so unexpected
dependency growth is visible.

## How parity is checked

`verify-bundle.mjs` evaluates the built bundle in a bare `node:vm` context — no
module loader, `var` lands on the global, the closest analogue to
`JSContext.evaluateScript` — and compares results against the core modules
themselves:

- **transpose:** against `@lavozmisionera/core/chordpro/index.js`, imported directly.
- **parse:** against `chordpro/parser.ts`. Node cannot import that file (its
  type-only import of `./types` is written as a value import, which Node's
  type-stripping keeps and then fails to link), so the reference side runs the same
  source through `esbuild.transform` — the same erasure Metro and Vite perform.
  Comparison is the full `SongDoc` as JSON, over 12 hand-written cases plus the six
  real fixtures in `apps/web/src/__tests__/fixtures/chordpro/` (read-only).
- **lint:** against `chordpro/lint.ts`. Same problem as the parser plus a real
  extensionless runtime import, so the reference goes through `esbuild.build`
  (bundling, not just transforming). Comparison is the full `LintWarning[]` as JSON
  over the parser corpus plus 12 cases written to trip each warning code, and every
  returned warning is checked for the exact key set `Core/LintWarning.swift` decodes
  — an added key would otherwise be silently dropped on the Swift side.
- **lint independence:** lint must return an array for every body the corpus
  contains, including ones the parser rejects. The editor shows warnings for exactly
  the bodies most worth reading them on, so lint must not fail alongside the parse.
- **hasMinRole:** the full role × minimum matrix against `rbac/roles.js`, including
  a role outside the hierarchy (`nonsense`) and the empty string, plus a hardcoded
  assertion that only editor/admin/owner clear the editor+ gate — so a hierarchy
  change that promoted `user` fails here rather than in the app. Keep both probes:
  the empty string is coerced to `user`, while an unknown role lands below every
  role and grants nothing, so they exercise different branches.
- **editing:** `insertAtCursor` and `wrapSection` against `chordpro/editing.ts`
  (transform only — it imports nothing). `wrapSection` is compared across **every**
  core `SECTION_PRESET` × five selection shapes, and each preset's output is then run
  through `parseToJSON` to assert it yields exactly one section. That last check is the
  one that matters: the parser only accepts verse|chorus|bridge|intro|tag|outro, so a
  preset emitting anything else would be silently dropped from the chart rather than
  erroring, and Pre-Chorus/Interlude are deliberately *named choruses* for that reason.
- **diatonicChords:** every key in core's `CHROMATIC_KEYS`, plus `Gb`, an unknown key
  and `''` (both → null). Every chord of every key is additionally tokenised and parsed
  back, so a button cannot insert a symbol the chart would fail to render.
- **slugify:** against `songs/slug.ts` over 16 titles including non-ASCII and
  punctuation-only, plus the contract Swift depends on — an unslugifiable title must
  return `''` so the caller refuses the insert rather than writing an empty `slug`.

## Adding another core function later

1. Export it from `entry.mjs` with argument validation at the boundary.
2. Add a typed Swift method to `CoreBridge` — no generic "evaluate this string"
   API, so every call site stays checkable.
3. Add cases to `verify-bundle.mjs` and re-run it.
