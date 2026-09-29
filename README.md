# GraceChords

> **LVM Worship fork:** This repository is the GraceChords-based music application
> for La Voz Misionera. The original project and its documentation remain below
> during baseline verification. See [product map](docs/product-map.md) and
> [fork audit](docs/fork-audit.md) for the LVM scope and staged roadmap.
>
> Local development without Supabase: `npm ci`, then `npm run dev:mock`.
> `npm run build:mock` builds that local mode. It currently displays sample
> songs only; it is not the full production app. The original Supabase-backed
> app remains available through `npm run dev` when credentials are configured.

### LVM Worship ↔ Platform (M7)

Platform owns the complete service. In the local `/setlist` draft, use **Abrir contexto de Platform**, add songs from the available library or import local ChordPro (`.cho`, `.chordpro`, `.pro`, `.txt`) files, then set order, keys, and repeated sections. **Guardar para Platform** exports a music-only `WorshipPlan 0.1` JSON. Platform validates and merges it into the selected musical block before exporting the unchanged `Service 0.1` to Presenter. The draft and imported context survive a browser restart in the same profile; keep the exported JSON as a portable backup.

For a local no-backend run of the full web app, build with nonworking public client placeholders, then block external requests or disconnect the network. In PowerShell:

```powershell
$env:VITE_SUPABASE_URL='https://offline.invalid'
$env:VITE_SUPABASE_ANON_KEY='offline-placeholder-key'
cd apps/web
npx vite build
```

These placeholders allow the existing web shell to start. The M7 draft and file exchange use only local files and `localStorage`; no Supabase service is contacted successfully. The saved-account setlist path remains outside this offline handoff.

GraceChords is a worship songbook platform for churches and worship teams. It
manages a [ChordPro](https://www.chordpro.org/) song catalog with fast search,
key transposition, setlist and songbook building, PDF/PPTX export, a full-screen
worship mode, and daily Bible readings.

- **Live web app:** [gracechords.com](https://gracechords.com)
- **Documentation:** the [GitHub Wiki](../../wiki) covers usage, features, and infrastructure in depth.

> **New here?** Jump to the app you're working on: **[web](apps/web/README.md)**
> or **[mobile](apps/mobile/README.md)**. This root README is the map; each app's
> README is the manual.

---

## What's in this repo

This is an **npm-workspaces monorepo**. Platform-agnostic logic is factored into
shared packages so the web and native apps can consume the same parser,
transposition, RBAC, and Supabase wiring.

```
GraceChords/
├── apps/
│   ├── web/            @gracechords/web    — React + Vite SPA (production site)
│   └── mobile/         @gracechords/mobile — Expo / React Native iOS app
├── packages/
│   ├── core/           @gracechords/core   — shared, DOM-free logic (ChordPro parser,
│   │                                         transposition, RBAC, setlist codec, Supabase factory)
│   └── tokens/         @gracechords/tokens — design tokens (web CSS + native TS map)
├── workers/            Cloudflare Workers (PPTX upload, sitemap rebuild, Telegram bot)
├── supabase/           SQL migrations (songs, users, posts, saved sets, …)
└── gc-ios-design-reference/   iOS design handoff bundle (mobile UI source of truth)
```

| Workspace | Package | What it is |
|-----------|---------|------------|
| `apps/web` | `@gracechords/web` | The production single-page app: full song catalog, setlists, worship mode, admin/editor portals, Daily Word, resources. Deployed to Cloudflare Pages. |
| `apps/mobile` | `@gracechords/mobile` | Native iOS client (Expo SDK 55, Expo Router v7). A themed four-tab shell (Home · Songs · Setlists · Daily Word) with a real chord-chart Song Viewer, Performer mode, the setlist builder, the Daily Word landing + reader (M'Cheyne reading, private journal reflections, an opt-in reading streak, and an anonymous, moderated public "Shared Reflections" feed behind a kill switch), and native Google/Apple auth. |
| `packages/core` | `@gracechords/core` | Pure TypeScript/JS shared by both apps — ChordPro **parser** (not the renderer), transposition, chord placement, song metadata/sort, the setlist codec, the role hierarchy, and the Supabase client **factory**. Consumed as source, no build step. |
| `packages/tokens` | `@gracechords/tokens` | The single home for design tokens. Web imports `tokens.css`; native imports the typed map from `@gracechords/tokens/native`. |
| `workers/*` | — | Cloudflare Workers deployed independently: authenticated PPTX upload/delete, weekly sitemap rebuild, and the `@gracechords_bot` Telegram bot. |

## Quick start

Use **Node.js 20 LTS**. Install all workspaces from the repo root:

```bash
npm ci
```

Then run the app you want:

```bash
npm run dev      # web dev server → http://localhost:5173
npm test         # web test suite (Vitest)
npm run build    # production web build → apps/web/dist/
```

The root `package.json` delegates these scripts to `@gracechords/web`. For the
full web setup (environment variables, Supabase, deployment) see
**[apps/web/README.md](apps/web/README.md)**. For the iOS app (Expo, simulator,
env) see **[apps/mobile/README.md](apps/mobile/README.md)**.

## Infrastructure at a glance

| Service | Role |
|---------|------|
| **Supabase** | Auth + Postgres — song catalog, users/roles, posts, starred songs, saved sets. Row-level security on every table. |
| **Cloudflare Pages** | Hosts the web SPA. Builds from the `apps/web` root directory to `apps/web/dist/` on every push to `main`. |
| **Cloudflare Pages Functions** | Server-side proxies at `apps/web/functions/` (`bible/`, `pptx/`, `api/`) that avoid CORS for R2 assets. |
| **Cloudflare R2** (`gracechords-bible`) | Stores PPTX slide decks (`pptx/`) and Bible chapter JSON (`bible/`). |
| **Cloudflare Workers** | `gracechords-pptx-upload` (authenticated PPTX writes), `gracechords-sitemap-rebuild` (weekly cron), `gracechords-telegram-bot`. |
| **Cloudinary** | Browser-side image hosting for song/post cover images. |
| **Resend** | Transactional email (server-side only). |

Full details live in the wiki's [Cloudflare Infrastructure](../../wiki/Cloudflare-Infrastructure)
page and in [`apps/web/AGENTS.md`](apps/web/AGENTS.md).

## Roles & access

GraceChords uses four roles: **user → editor → admin → owner**.
The hierarchy is defined once in `packages/core/src/rbac/roles.js` and enforced
via `hasMinRole()`. See [Roles & Access](../../wiki/Roles-and-Access) for the
permission matrix and the admin/editor portals.

## Roadmap

Current focus and planned work:

- **Tablet-responsive web layout** — a proper master-detail experience on larger screens.
- **Mobile app polish** — the iOS client's core flows ship (Song Viewer, Performer, Setlists, Daily Word with offline Bible downloads, recent-song history, auth); next up are password reset, offline song persistence, and EAS Build / TestFlight.
- **Android** — extend the Expo app to Android once the iOS surface stabilizes (Android OAuth config still to set up).
- **GraceTracks integration** — surface practice stem tracks (`has_stems` / `stem_slug` / `gracetracks_url`) across web and mobile.
- **Shared-core growth** — migrate more query/util logic into `@gracechords/core` as the mobile app needs it, keeping web and native in lockstep.

## Contributing & conventions

- **Agent / AI development guidance:** [`AGENTS.md`](AGENTS.md) is the root guide.
  It routes to per-app docs — [`apps/web/AGENTS.md`](apps/web/AGENTS.md) and
  [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md) — for platform-specific rules.
- **Contributing guide:** [Contributing](../../wiki/Contributing) in the wiki.
- **Code of Conduct:** [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
- **Security policy:** [`SECURITY.md`](SECURITY.md).
- **Monorepo migration notes:** [`MONOREPO_MIGRATION.md`](MONOREPO_MIGRATION.md) (historical record of the workspaces cutover and Cloudflare settings).

## License

Licensed under the terms in [`LICENSE`](LICENSE). See [`NOTICE`](NOTICE) for
attribution.
