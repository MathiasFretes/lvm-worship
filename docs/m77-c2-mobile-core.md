# M7.7C2 — Migración del núcleo Mobile

Fecha: 2026-10-07. Rama: `claude/m77-worship-independence-audit`. Alcance: navegación, biblioteca, búsqueda, lector de canción y repertorios. Editor de canción, Performer/Worship Mode, Auth, contenido y Studio quedan fuera de este bloque.

## Conservado y cambiado

| Flujo | Se conserva | Implementación LVM de C2 | Dependencias retenidas |
| --- | --- | --- | --- |
| Navegación | Cinco destinos, barra nativa Expo, etiquetas traducidas, tint de tokens y soporte iOS anterior a 26 | Nuevo layout compacto de pestañas | Expo Router/React Navigation y `ThemeProvider` |
| Biblioteca | Catálogo y borradores, filtros de tags, orden, índice A–Z, tablet grid, crear borrador, abrir lector, estados de carga/vacío/error | Pantalla y modelo `libraryPresentation`; modelo `songCatalogModel` para fusionar fuentes | Primitives nativos, hooks de consulta y repositorio actual |
| Búsqueda | Título antes de etiqueta; artista excluido | `packages/core/src/songs/search.ts`, tolerante a tildes y mayúsculas, usado por biblioteca y pickers móviles | Adaptador de API `songSearch.ts` hasta migrar todos los consumidores |
| Lector | Letra/acordes, transposición, controles, exportación y borradores personales | Header LVM y cálculo puro `songViewerKey` | Parser/transposición de core, chart y exportadores existentes (inventario B9) |
| Repertorios | Crear, duplicar y eliminar repertorios; renombrar, ordenar, tonalidades, versículos, compartir/exportar, autosave y tablet pane | Nuevas pantallas de lista y builder sobre el contrato actual; la timeline ahora expone `duplicateEntry` para repetir una canción sin quitar otra aparición | `useSetlists`, `useSetlistBuilder`, repositorios y componentes auxiliares conservados |

El trabajo de C2 reemplaza la orquestación de las pantallas principales, **no** declara originales todos sus componentes o dependencias. El inventario B9 identifica qué módulos compartidos siguen coincidiendo con la referencia. Las rutas y datos de Supabase no cambiaron; no hay migración de base.

## Verificación

- TypeScript: `npm run typecheck` ✅
- Mobile: 856 tests en 73 archivos ✅
- Traducciones: español, coreano y turco sincronizados con inglés ✅
- `expo export --platform android` ✅
- `expo export --platform ios` ✅
- Web: 436 tests, lint y build Vite ✅ (por el nuevo export de core)
- Build nativo Android de desarrollo: `:app:assembleDebug` ✅; APK arm64 instalado en el teléfono autorizado `ELP_NX9` ✅. Metro entregó el bundle y la app abrió ✅. El primer arranque mostró la pantalla controlada **Configuration missing** porque no están configuradas `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Navegación táctil, gestos y layout de canciones/repertorios en dispositivo: **pendiente**. El usuario confirmó que todavía no dispone de un entorno ni cuenta de QA. El route gate requiere configuración de Supabase antes de mostrar esas pantallas. No se crearon canciones ficticias ni se usaron credenciales de producción para dar la prueba por aprobada.
- Para esta compilación de QA se usaron solo ajustes en archivos ignorados: proyecto `android/` generado por Expo, wrapper Gradle 9.1.0 para evitar el fallo local de transform cache de 9.0.0, descarga local del prebuilt de `react-native-audio-api`, un vector faltante en `expo-dev-menu` y una ruta corta de staging CMake para evitar el límite de longitud en Windows. Esos ajustes **no forman parte del código versionado** y el build reproducible sin ellos sigue pendiente. El icono `assets/icon.png` configurado en `app.json` sigue ausente.

## Deuda explícita

1. `apps/mobile/app.json` todavía referencia `assets/icon.png`, ausente. Los bundles JS compilan, pero un build nativo/release necesita un ícono original con procedencia LVM.
2. Gran parte del chart, parser ChordPro, hooks/repositories y assets móviles siguen retenidos de la implementación anterior. Su reemplazo está inventariado; no afirmar independencia total de Mobile con C2.
3. Cuando exista un entorno y una cuenta de QA, comprobar en el teléfono autorizado: abrir cada tab, buscar con y sin tildes, abrir canción de catálogo y borrador, editar un setlist con repetición/tonalidad/versículo, cerrar/reabrir y confirmar persistencia. Esta auditoría no manipuló datos remotos.
