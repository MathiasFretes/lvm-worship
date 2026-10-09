# M7.7B9 — Auditoría del núcleo compartido

Fecha: 2026-10-07. Base LVM: `9418b57`. Comparación de blobs en la misma ruta con `rwm6857/GraceChords` `5cb40d2`. Igualdad de SHA prueba igualdad de contenido; un SHA distinto o una ruta nueva **no** prueban autoría LVM. Este inventario describe código activo, no asigna licencia al repositorio LVM.

El [inventario de blobs por archivo](m77-provenance-blobs.tsv) conserva los SHA de esta comparación, incluidos todos los archivos de core y las rutas compartidas inspeccionadas.

## Evidencia y decisiones

| Pieza activa | Uso verificado | Procedencia observable | Decisión |
| --- | --- | --- | --- |
| `packages/core/src/chordpro/{lexer,parser,types,convert,serialize,lint,editing}` | Editor, lector, Worship Mode, exportación, contrato Service y Mobile | Blobs idénticos en la misma ruta | **REIMPLEMENT LVM**, por etapas y con los tests de conformidad actuales como contrato; conservar mientras no exista sustituto probado |
| `packages/core/src/chordpro/{index.js,diatonicChords.js,scaleDegrees.ts,solfege.js}` | Transposición, tonalidades, visualización y exportación | Blobs idénticos | **REIMPLEMENT LVM** una sola vez en core; Web/Mobile/Studio deben consumir la misma semántica |
| `packages/core/src/songs/{chords,sort,slug,songAuthoring,songsRepo,songsWriteRepo,personalSongsRepo,songMetadata}` | Catálogo, escritura, lector y repertorios | Blobs idénticos | **REIMPLEMENT LVM** por función; separar reglas puras de adaptadores de persistencia |
| `packages/core/src/setlists/{setlistsRepo,setlistSummary,setcode,copyName,limits}` | Persistencia y formatos de repertorio | Blobs idénticos | **REIMPLEMENT LVM** preservando datos y compatibilidad; no cambiar formato durante B9 |
| `apps/web/src/utils/chordpro/*` (reexports) | Importaciones de lector, editor, exportación y Mode | La mayoría son fachadas hacia core, no motores independientes | **RENAME** gradualmente a imports directos de core después de migrar consumidores; no mantener dos implementaciones |
| `apps/web/src/components/song/ChordRender.jsx`, `apps/web/src/utils/songs/chordLineLayout*` | Render de acordes en lector y Mode | Código conservado de la arquitectura anterior; verificar cada blob antes de sustituir | **REIMPLEMENT LVM** en la vertical de lectura/render; no declararlo propio por el nuevo Mode |
| `apps/web/src/utils/songs/{search,songCatalog,tags,quickActions}` y `hooks/{useSongs,useDraftSetlist,useSetlistBuilder}` | Biblioteca, búsqueda, editor, repertorios | Mezcla de archivos coincidentes y modificados; cambio de SHA no acredita autoría | **KEEP** como compatibilidad funcional temporal; extraer reglas puras a core y reimplementar hooks/adaptadores en sus verticales |
| `apps/web/src/lvm/{localSong,serviceAdapter,worshipPlan}` | Puente Service → Worship → Service | Sin equivalente en la misma ruta; tests de contrato específicos | **KEEP** como límite LVM; revisar procedencia de implementación por separado |
| React, Expo, Supabase y librerías de runtime | UI y transporte de datos | Paquetes externos declarados | **THIRD-PARTY DEPENDENCY**; mantener declarados y revisar licencias en el inventario de dependencias |

`packages/core`: 55 archivos rastreados, 49 idénticos, 6 diferentes, 0 rutas nuevas. En el subconjunto Web compartido comparado (`components/song`, `hooks`, `utils`): 49 idénticos, 44 diferentes y 1 ruta nueva. Las cifras incluyen tests y fachadas. La prioridad es conservar comportamiento y sustituir implementación de forma verificable; B9 no autoriza un reemplazo masivo del parser.

## Gate

- `git ls-files -- node_modules/.cache/worship-mode-smoke.cjs` no devuelve archivo. `.gitignore` ignora `node_modules/`.
- ChordPro ya tiene `CHORDPRO-AUDIT.md` y pruebas de lexer, parser, serializador, lint, secciones y transposición; son la base de compatibilidad para una reimplementación posterior.
- `npm run lint` de Web, 436 tests Web (incluyen pruebas de ChordPro/core) y `npx vite build` pasaron en esta rama. La generación SEO del `npm run build` completo requiere credenciales remotas que no están en este entorno.

## Orden de sustitución

1. Extraer reglas puras de búsqueda y modelo de canción compartidas por Web/Mobile, con entradas/salidas estables.
2. Sustituir parser/transposición en core bajo pruebas de compatibilidad, sin bifurcar Web y Mobile.
3. Sustituir repositorios y hooks por adaptadores LVM cuando estén definidos persistencia e identidad.
4. Migrar fachadas e imports Web; retirar las fachadas solo cuando no haya consumidores.
