# Song practice reader

The song view now uses the Cifra Club reference layout with LVM's own navy/gold
palette. Other Worship routes retain their existing layout and theme. Administration
continues to belong to LVM Service.

## Controls

- Transposition, capo and lowered tuning distinguish sounding pitch from written
  chord shapes. Chord playback includes the capo/tuning offset.
- Guitar, keyboard, ukulele, cavaquinho and viola caipira diagrams are generated
  from chord notes. Unsupported chord qualities show an unavailable state rather
  than an unrelated diagram. String diagrams include alternative positions,
  fingering and barres; generated fingerings are starting points for practice.
- Diagram size, start/end placement, pinning and opening a diagram from the lyric
  can be adjusted. Chord audio is synthesized with Web Audio after a user action.
- Text scaling, American/solfege notation, embedded tablature and written strumming
  visibility are available. Reading preferences persist on the current device.
- Two-column reading supports height/width, horizontal paging and full screen.
  Narrow screens use one column and a modal tool panel.
- Auto-scroll has speed and pause controls; manual scrolling, keyboard interaction,
  visibility loss and full-screen changes pause it.
- Existing repertory, editor, PDF/JPG/ChordPro/PPTX availability, musical-material
  pages, tuner and metronome are retained. Sharing includes key, capo and tuning.
  Print mode hides tools and uses dark ink on a white background.

No paid-service integration, smart listening/automatic song following, alternate
community arrangement catalog or hardware pedal pairing was added. Those are not
equivalent to standard auto-scroll, translations or ordinary keyboard controls.
No native API deployment is part of this change.

## Validation (23 November 2026)

The web suite passed 561 tests in 96 files, lint and locale-key parity. The complete
build passed using the public VPS PostgreSQL catalog endpoint. That catalog was
empty during the build; seven static shell pages and the sitemap were generated.

`node apps/web/scripts/verify-song-practice.mjs` checks 17 browser scenarios against
a read-only local preview backed by the isolated QA API. A long original chart is
intercepted only in the test browser; no production catalog data is written. The
checks cover reference typography, brand colors, audio frequencies, transposition,
capo/tuning, solfege, persistence, columns/full screen, tabs/strumming, diagrams,
auto-scroll, actual PDF/ChordPro/JPG downloads, sharing, mobile focus/overflow,
print styles, search and practice-tool lifecycle.

The tuner test uses Chromium's synthetic media device, not a physical microphone.
The A12 native integration gate remains separate and pending. Local screenshots,
downloaded test exports and the browser report are under the ignored
`test-results/song-practice/` directory. The gold chord color on the navy reader
background measured 6.70:1 contrast.

The palette is defined in `packages/tokens/tokens.css`; reader behavior and styles
live under `apps/web/src/features/song-practice/`. Roboto and the existing Roboto
Mono files are local assets; the new Roboto variable font includes its OFL license.


## Reconciliation and editor QA (23 November 2026)

Production Worship serves `7364f3ee8ae15ca2b4fb919cdc0c1e57951fd18e`.
The Spanish editor and preview alignment fixes are included in that version.
`DEFAULT_LOCALE` remains `en`: an explicit Spanish selection is respected; this
release does not change the default-language policy.

`node apps/web/scripts/verify-editor-locale.mjs` is a reproducible browser check.
Set `LVM_EDITOR_PREVIEW_URL=https://srv2137598.hstgr.cloud` to inspect the served
frontend. It intercepts all API reads with isolated fixture sessions and blocks
all API writes. It checks Spanish fields/help/preview, unchanged ChordPro,
chord-to-lyric alignment, light/dark modes at 1440/390 px, and distinct editor/user
save-versus-review actions. Its report and screenshots are in
`test-results/editor-locale/`, uploaded by the PR workflow.

These are frontend checks, not evidence of real PostgreSQL authorization or
successful publication. Public test-song saving still awaits explicit user
confirmation. Real draft/proposal persistence and permission gates, the physical
Android gate and integration into `main` remain separate acceptance criteria.
