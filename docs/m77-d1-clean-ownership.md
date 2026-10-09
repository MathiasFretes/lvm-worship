# M7.7D1 — LVM Worship Clean Ownership

Fecha: 2026-10-07. Criterio: **cero coincidencias heredadas activas sin explicación**, no cero hashes matemáticos. Un blob distinto no prueba autoría legal; un blob idéntico al árbol de referencia en la misma ruta sí prueba coincidencia de contenido.

Comparación: `git hash-object` del working tree contra `reference_blob` en `m77-provenance-blobs.tsv` (web/core/mobile) y `m77-c4-studio-provenance.tsv` (studio). Referencia histórica: `rwm6857/GraceChords` `5cb40d2`.

## Gate

- [x] Web: sin implementación heredada activa
- [x] Core: sin implementación heredada activa
- [x] Mobile: sin implementación heredada activa
- [x] Studio: sin implementación heredada activa
- [x] assets heredados eliminados/reemplazados
- [x] textos/URLs/branding antiguos eliminados
- [x] tests heredados eliminados/reimplementados
- [x] infraestructura histórica innecesaria eliminada
- [x] escrituras nuevas migradas a `lvm.*`; Studio conserva lectura de `gc.*` para migrar preferencias antiguas
- [x] dependencias legítimas clasificadas
- [x] archivos generados clasificados
- [x] provenance scan final realizado

## Heredado activo

| Área | Heredado activo |
| --- | ---: |
| Web | 0 |
| Core | 0 |
| Mobile | 0 |
| Studio | 0 |
| Assets | 0 |
| Branding | 0 |

## Scan final (coincidencias de blob)

| Área | Idénticos | Distintos | Ausentes (REMOVE) |
| --- | ---: | ---: | ---: |
| Web | 0 | 90 | 4 |
| Core | 0 | 55 | 0 |
| Mobile | 3 | 405 | 3 |
| Studio | 7 | 79 | 2 |

Los 10 idénticos restantes no son código de producto LVM. Clasificación KEEP:

| Path | Clase | Procedencia |
| --- | --- | --- |
| `apps/mobile/assets/fonts/MaterialSymbolsFilled.ttf` | THIRD_PARTY | Subset Google Material Symbols (Apache-2.0); ver `apps/mobile/assets/PROVENANCE.md` |
| `apps/mobile/assets/fonts/MaterialSymbolsOutlined.ttf` | THIRD_PARTY | Subset Google Material Symbols (Apache-2.0) |
| `apps/mobile/assets/google-g.webp` | THIRD_PARTY | Marca Google exigida en el botón de Google Sign-In; no es identidad LVM |
| `apps/studio/.gitignore` | GENERIC_CONFIG | Plantilla Xcode/git genérica |
| `.../contents.xcworkspacedata` | GENERIC_CONFIG | Workspace Xcode mínimo |
| `.../WorkspaceSettings.xcsettings` | GENERIC_CONFIG | Ajustes de workspace Xcode |
| `.../Package.resolved` | THIRD_PARTY / GENERATED | Lockfile SPM (`supabase-swift` y pins transitivos) |
| `.../AccentColor.colorset/Contents.json` | GENERIC_CONFIG | Catálogo de colorset vacío de Xcode |
| `.../Assets.xcassets/Contents.json` | GENERIC_CONFIG | Catálogo de asset catalog de Xcode |
| `apps/studio/scripts/ExportOptions.plist` | GENERIC_CONFIG | Opciones de exportación/notario de Xcode |

Ausentes deliberados (REMOVE): `usePosts.jsx`, `fetchCache.js`, `github.js`, `pdf_mvp/README.md`, `BottomSheet.tsx`, `Placeholder.tsx`, `RowActionsSheet.tsx`, `SPIKE-RESULTS.md`, `generate-appicon.swift`. También se retiraron `gc-brand-wide-*.svg`, `src/data/resources.json` y las URLs `/posts` / `/resources` del associated-domain Android y del sitemap.

Assets de identidad LVM: icono, splash y 15 sprites regenerados desde `apps/mobile/assets/lvm-mark.svg` / generador LVM (`apps/mobile/assets/PROVENANCE.md`). Tokens `--lvm-*`, factory `createLvmSupabase`, claves `lvm.*`.

Auth en Worship se conserva como adaptador mínimo hasta M9. CMS/blog no tiene UI, rutas ni índice en Worship.

## Gates ejecutados 2026-10-07 (Windows)

| Gate | Resultado |
| --- | --- |
| Web tests | 482 / 77 archivos |
| Web lint | 0 errores |
| Web i18n | 0 issues |
| Web Vite build | OK |
| Mobile tests | 902 / 78 archivos |
| Mobile TypeScript | `tsc --noEmit` OK |
| Mobile i18n | 0 issues |
| Android export | OK |
| iOS export | OK |
| Studio JS bridge | ALL CHECKS PASSED |

Fuera de este host: build/tests nativos de Studio en macOS; QA táctil Mobile. No bloquean D1.

## THIRD-PARTY LEGÍTIMO (producto)

No es código heredado de otro producto. Inventario de paquetes instalados: `apps/web/src/content/third-party-licenses.md`.

- React / React DOM
- Expo SDK 55 y React Native
- `@supabase/supabase-js` y `supabase-swift`
- Vite, Vitest, ESLint, TypeScript
- i18next
- Lucide, Fuse.js, jsPDF, JSZip, pptxgenjs, DOMPurify, marked
- Tipografías Noto Sans / Noto Sans Mono (PDF)
- Google Material Symbols (Android) y SF Symbols (iOS, plataforma)
- Marca Google G (OAuth)
- Frameworks Apple (SwiftUI, AppKit, PDFKit, JavaScriptCore)

## Siguiente

Licencia propia de LVM Worship: decisión formal aparte. Siguiente bloque de producto: **M7.9-0 — Suite Integration Baseline**.
