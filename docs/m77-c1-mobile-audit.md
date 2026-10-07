# M7.7C1 — Auditoría de independencia Mobile

Fecha: 2026-10-07. Base LVM: `9418b57`; referencia de comparación `rwm6857/GraceChords` `5cb40d2`. Los SHA se compararon por ruta. Una ruta o hash diferente no prueba autoría propia.

El [inventario por archivo](m77-provenance-blobs.tsv) registra los SHA de rutas, fuentes y assets. `DIFFERENT_REVIEW_REQUIRED` exige revisión humana; no se clasifica automáticamente como código original.

## Rutas y funciones

| Área | Rutas/componentes activos | Procedencia / clasificación | Migración |
| --- | --- | --- | --- |
| Shell y navegación | `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, cinco tabs Home/Songs/Setlists/Daily/Utilities | Tab layout idéntico: **INHERITED**. Expo Router/NativeTabs: **THIRD-PARTY** | **REIMPLEMENT** capa de definición de navegación LVM, conservando rutas y barra nativa |
| Biblioteca y búsqueda | tab `songs`, `SongLibraryScreen`, `useSongList`, `songSearch`, filtros y componentes de lista | Pantalla/hook **MIXED**; `songSearch.ts` idéntico: **INHERITED** | **REIMPLEMENT** consulta, búsqueda y vista en C2; usar dominio compartido |
| Detalle de canción | `viewer/[slug]`, `useSong`, `ChordChart`, controles de tonalidad y exportación | **MIXED/INHERITED**; consume ChordPro core coincidente | **REIMPLEMENT** orquestación y UI principal en C2 sin duplicar transposición |
| Repertorios | tab `setlists`, `setlist/[id]`, `SetlistsScreen`, `SetlistBuilderScreen`, `useSetlists`, `useSetlistBuilder`, componentes de setlist | Pantallas modificadas pero base conservada: **MIXED**; repositorio core idéntico | **REIMPLEMENT** flujo central C2, preservando filas, repeticiones, tonalidades y datos |
| Editor y modo músico | `editor/[draftId]`, `perform/[id]`, `SongEditorScreen`, `PerformerScreen` | **MIXED/INHERITED** | C3, fuera de C2 |
| Identidad | `login`, `auth-link`, recuperación, cuenta, `src/lib/auth*`, `supabase` | **MIXED**; SDK **THIRD-PARTY** | Consumir identidad de Service en M8/M9; conservar sesión actual hasta migración |
| Offline/local | `offline`, `downloads/*`, `draftsStore`, `recents`, `viewerPrefs` | **MIXED/INHERITED** | Auditar formato antes de migrar; no borrar datos locales en C2 |
| Sincronización y Service | hooks Supabase actuales; no hay un handoff Mobile → Service independiente identificado en las rutas principales | **MIXED**; falta integración específica | Mantener contrato de Web sin inventar sincronización Mobile en C2 |
| Contenido y utilidades | Daily, devotional, reader, tuner, metronome, etc. | **MIXED/INHERITED** | Ownership B7/B8 y futuras verticales; no desplazar en C2 |

Comparación: `apps/mobile/app` 36 rutas, 33 idénticas y 3 diferentes; `apps/mobile/src` 350 archivos, 222 idénticos y 128 diferentes; `apps/mobile/assets` 25 archivos, 24 idénticos y 1 diferente. Estas cifras incluyen pruebas, fuentes y recursos; no implican que todo archivo diferente sea LVM.

## Assets y dependencias

`assets/README.md`, `adaptive-icon.png`, `mark.webp`, splash, sprites y fuentes están inventariados. 24/25 blobs coinciden con la referencia; los gráficos y sprites requieren sustitución con procedencia LVM antes de afirmar independencia visual. `app.json` apunta a `assets/icon.png`, archivo no rastreado y ausente: gate de release pendiente. No se reutilizarán esos assets como base para gráficos supuestamente nuevos.

`package.json` declara Expo SDK 55, React Native, Expo Router, React Navigation, Supabase, i18next y módulos Expo/React Native. Son dependencias externas legítimas (**THIRD-PARTY**), no autoría LVM. La presencia del SDK Supabase expresa el adaptador actual; no cambia el ownership futuro de identidad y datos.

## Duplicación Web/Mobile

- Web usa `utils/songs/search`, Mobile usa `src/lib/songSearch`: normalización y ranking deben vivir en un paquete de dominio común, con UI específica por plataforma.
- Web y Mobile ya consumen `@lavozmisionera/core` para ChordPro/transposición, pero ese core conserva muchos blobs idénticos al origen. Compartir código reduce divergencia, no acredita autoría.
- Web `useSongs` y Mobile `useSongList` consultan el mismo catálogo con modelos/estados separados; extraer contratos de datos y mantener hooks de UI por plataforma.
- Web y Mobile usan repositorios de setlists de core, pero cada uno administra orden local e interacción; preservar formato de datos mientras se reemplaza la orquestación.

## Plan C2

1. Congelar rutas y traducciones de las cinco tabs; conservar controles nativos del sistema.
2. Crear selector/modelo de canciones compartido y migrar la búsqueda Mobile; conectar Web cuando pase su compatibilidad.
3. Sustituir biblioteca y detalle Mobile por componentes LVM sobre hooks/contratos existentes, con estados de carga, vacío y error.
4. Sustituir el flujo central de repertorios, preservando IDs, apariciones repetidas, claves y autosave.
5. Verificar TypeScript, tests, i18n, bundles Android/iOS y navegación. Editor, Performer, Auth y CMS quedan fuera de C2.
