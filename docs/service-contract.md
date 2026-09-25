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

`items` preserves service order. IDs are stable and unique inside one service. `startsAt` is an ISO 8601 instant with offset. Text for Scripture travels with the JSON so projection does not require a Bible API. The sample uses one RV1909 verse; translation and distribution rights remain a content decision for production material. Chords use Unicode character offsets from the start of a lyric line. A section becomes one FreeShow slide in the initial adapter. This version does not express repetitions, timers, media, notes, permissions, or live collaboration. Changing the structure requires a new `schemaVersion` and a corresponding Presenter adapter.

## Local handoff

1. Use Node 22.23.0 (`.node-version`), `npm ci`, then `npm run dev:mock`.
2. Click **Exportar servicio JSON**; compare the download with `fixtures/sunday-service.json`.
3. In `C:\lvm-presenter`, run `npm run lvm:service-to-project -- C:\la-voz-misionera\fixtures\sunday-service.json examples\sunday-service.project`.
4. Import `examples/sunday-service.project` through FreeShow's project import menu. Open a show and click a slide to send it to output.

The mock screen supplies the service plan locally. The production setlist and song screens still use their existing data sources; connecting their current state to this adapter is a separate integration step after contract validation.
