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
- Navegación táctil, gestos y layout en dispositivo: **pendiente**. El teléfono `ELP_NX9` aparece autorizado en `adb devices`, pero solo tiene Expo Go; no hay dev client de LVM Worship instalado. Se instalaron Android SDK Platform 36 y Build Tools 36.0.0; `expo prebuild --platform android --no-install` generó el proyecto nativo ignorado por Git. `:app:assembleDebug` se detuvo antes de compilar la app porque Gradle 9.0.0 no pudo mover un directorio temporal a `C:\Users\mathi\.gradle\caches\9.0.0\transforms\...`; el fallo se repitió con un solo worker. No se generó ni instaló un APK. El icono configurado en `app.json` también sigue ausente. Un bundle correcto no demuestra el comportamiento táctil.

## Deuda explícita

1. `apps/mobile/app.json` todavía referencia `assets/icon.png`, ausente. Los bundles JS compilan, pero un build nativo/release necesita un ícono original con procedencia LVM.
2. Gran parte del chart, parser ChordPro, hooks/repositories y assets móviles siguen retenidos de la implementación anterior. Su reemplazo está inventariado; no afirmar independencia total de Mobile con C2.
3. Cuando exista una build de desarrollo instalable, comprobar en el teléfono autorizado: abrir cada tab, buscar con y sin tildes, abrir canción de catálogo y borrador, editar un setlist con repetición/tonalidad/versículo, cerrar/reabrir y confirmar persistencia. La prueba requiere una cuenta/datos de QA; esta auditoría no manipuló datos remotos.
