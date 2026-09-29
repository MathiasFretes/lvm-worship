# Service contract 0.1

This repository owns the portable service plan. `fixtures/sunday-service.json` is the canonical example for the local Worship → Presenter slice. Export it from `npm run dev:mock` using **Exportar servicio JSON**. The adapter is `apps/web/src/lvm/serviceAdapter.js`; it parses the same ChordPro content used by the web song viewer and removes GraceChords/Supabase fields.

## Minimal domain

| Entity | Fields in 0.1 | Purpose |
| --- | --- | --- |
| Song | `id`, `title`, `key`, `sections` | Portable lyric and chord source |
| SongSection | `kind`, `label`, `lines[{text,chords[{symbol,index}]}]` | One logical projection segment |
| Setlist | `id`, `name`; ordered song IDs in the source plan | Worship ordering |
| ScriptureReference | `reference`, `version`, `text`, `source` | Offline verse with attribution |
| ServiceItem | `id`, `kind`, one typed payload | Ordered song, scripture, announcement, or sermon |
| Service | `schemaVersion`, `id`, `title`, `startsAt`, `setlist`, `items` | Single transfer object |

`items` preserves service order. IDs are stable and unique inside one service. `startsAt` is an ISO 8601 instant with offset. Text for Scripture travels with the JSON so projection does not require a Bible API. The samples use RV1909 verses; translation and distribution rights remain a content decision for production material.

Chord `index` is a zero-based UTF-16 code-unit offset in `line.text`, matching JavaScript `String.length` and the ChordPro parser. It must be in `[0, text.length]` and cannot split a surrogate pair. It is not a Unicode code-point or grapheme-cluster index. For example, the offset after `😀` advances by two UTF-16 units. A section becomes one FreeShow slide. Repetitions are represented by repeating section objects in playback order, so `Verso 1 → Coro → Coro` needs no new field or schema version. This version does not express timers, media, notes, permissions, or live collaboration.

`fixtures/hostile-service.json` exercises a seven-section arrangement, accented lyrics, `ñ`, an emoji, intermediate chords, and two separate scripture items. `apps/web/scripts/generate-m5-fixture.mjs` regenerates it through the Worship adapter. The draft setlist editor stores a section sequence per song occurrence as one-based comma-separated numbers (`1,2,3,2,4,2,2`); export expands it into repeated section objects. Saved Supabase setlists export their current song order, key choices, and default ChordPro section order. Their custom section sequence is not persisted until the saved-setlist data model supports it.

## Local handoff

1. Use Node 22.23.0 (`.node-version`), `npm ci`, then `npm run dev:mock`.
2. Click **Exportar servicio JSON**; compare the download with `fixtures/sunday-service.json`.
3. In `C:\lvm-presenter`, run `npm run lvm:service-to-project -- C:\la-voz-misionera\fixtures\sunday-service.json examples\sunday-service.project`.
4. Import `examples/sunday-service.project` through FreeShow's project import menu. Open a show and click a slide to send it to output.

The setlist workspace now exports its current controller state through `buildServiceFromSetlist`, which accepts plain items and catalog songs and does not query Supabase. Drafts persist their arrangement and a snapshot of each selected song in localStorage; a previously assembled draft can be reopened and exported without a live catalog connection. Adding a new song still requires a catalog source. A date-only setlist date becomes midnight UTC in the exported JSON; absent a setlist date, export uses the current instant. A verse entry without local text fails clearly rather than silently exporting an empty scripture slide. The mock screen remains a deterministic contract example.
