# Worship flow audit

## Existing route and data path

| Stage | UI | Data and core dependency | Boundary |
| --- | --- | --- | --- |
| Song catalog | `apps/web/src/pages/SongsPage.jsx` | `useSongs.jsx` fetches/normalizes public songs; client in `src/lib/supabase.js` | Supabase required in production |
| Song detail | `SongViewPage.jsx` | `useSongs`; personal song fetch through Supabase; `parseChordProOrLegacy` and transposition from shared `packages/core` | ChordPro document is portable |
| Setlist builder | `SetlistWorkspacePage.jsx` | `useSetlistBuilder.js` for saved Supabase sets, `useDraftSetlist.js` for a local draft; setlist codec and transposition in core | Draft survives locally; saved sets require auth/data service |
| Performance view | `WorshipModePage.jsx` | Song IDs from route/setlist, `useSongs`, shared parser and transposition, Bible utilities | Current performance UI is browser-side |

The dependency direction is UI → hooks/queries → Supabase for catalog and saved sets, while parsing and transposition are UI → `packages/core`. Export belongs after the setlist and catalog have been resolved, where the adapter receives plain data. It must not read the Supabase singleton or mutate a saved set. The local mock is the first caller: `apps/web/src/mock/data.js` → `apps/web/src/lvm/serviceAdapter.js` → download in `apps/web/src/mock/main.jsx`.

## Decisions and remaining integration

The adapter converts ChordPro sections and chord positions to a versioned Service JSON. This lets the performance and projection clients evolve separately. The fixture has three sample songs, one RV1909 verse, an announcement, and a sermon. The verse text is embedded, allowing an offline test. Current saved-set UI has no complete Service model or export command; wiring its actual setlist, date, scripture, and non-song items into this adapter remains to be done. No runtime Supabase paths were changed in this slice.
