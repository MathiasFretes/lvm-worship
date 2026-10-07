# M7.7C4 — Auditoría de independencia de LVM Worship Studio

Fecha: 2026-10-07. Rama: `claude/m77-worship-independence-audit`. Referencia de comparación: árbol público `rwm6857/GraceChords` en `5cb40d2`. La comparación normaliza únicamente los nombres de directorio/producto `La Voz Misionera Studio` ↔ `GraceChords Studio` y los dos nombres de archivo de entrada. [El inventario por archivo](m77-c4-studio-provenance.tsv) guarda ambas rutas y SHA de blobs. Un SHA distinto **no** prueba implementación original; un SHA igual prueba contenido idéntico.

La columna `content_relation` del TSV usa `IDENTICAL` cuando `lvm_blob` y `reference_blob` coinciden; `DIFFERENT_REVIEW_REQUIRED` exige revisión humana y no acredita autoría LVM. La clasificación por área (`MIXED`, `THIRD-PARTY`) resume el TSV y el contexto B9; no sustituye la revisión fila por fila.

## Resultado por área

| Área activa | Función | Evidencia y clasificación | Decisión C5 |
| --- | --- | --- | --- |
| Proyecto Xcode y shell (`ContentView`, `Navigation`, `StudioCommands`) | Arranque, autenticación, biblioteca/Manage, menú y prevención de pérdida de edición | Mismas rutas normalizadas que la referencia, blobs modificados: **MIXED / REVIEW REQUIRED** | Reimplementar shell y navegación LVM conservando accesos y confirmación de cambios pendientes; dejar configuración de Xcode verificable. |
| `Auth`, `Config`, `Services`, `Data` | Sesión, rol, cliente Supabase, repositorios de canciones/favoritos, exportación | Estructura heredada con cambios: **MIXED**. `supabase-swift` es **THIRD-PARTY** declarado. | Mantener el adaptador de datos temporalmente; separar reglas LVM de persistencia y no cambiar tablas ni RLS en C5. Identidad central queda para M8/M9. |
| `Core`, `js` y recurso JavaScriptCore | Parser/transposición/edición/roles de `packages/core` en Swift | Bridge y bundle modificados, pero B9 identificó muchos blobs idénticos en el core subyacente: **MIXED**. JavaScriptCore es framework de Apple. | Conservar un solo motor de dominio compartido. Sustituir el core por función según B9; verificar paridad del bundle antes de cambiar llamadas Swift. |
| `Library`, `Viewer`, `Manage`, `Editor`, `Import` | Catálogo, cifrado, formulario, borradores y PDF | Todas las rutas tienen antecedente normalizado y SHA diferente: **REVIEW REQUIRED**, no autoría demostrada. | Reimplementar la orquestación y vistas por flujo con pruebas de comportamiento; conservar formatos de canción y borrador durante la transición. PDFKit/AppKit/SwiftUI son dependencias legítimas. |
| `Design` y `packages/tokens` | Tokens Swift generados desde `native.ts` | Fuente de verdad compartida y archivos generados, con nombres `GC*` todavía activos: **MIXED**. | Mantener generación reproducible; renombrar símbolos únicamente junto con consumidores y tests, sin editar el Swift generado a mano. |
| `Assets.xcassets/AppIcon.appiconset` | Icono del producto | **Los diez PNG del icono son byte por byte idénticos a la referencia.** `Contents.json` difiere de la referencia únicamente en metadatos de generación. | Reemplazar por arte LVM original y generar todos los tamaños desde una sola fuente. El script actual espera `apps/mobile/assets/icon.png`, que no está rastreado. |
| `StudioTests`, `scripts`, documentación | Pruebas, distribución y guía | Cinco tests Swift conservan rutas equivalentes con blobs modificados; `ExportOptions.plist` idéntico es configuración genérica. **MIXED / THIRD-PARTY tooling**. | Ampliar pruebas del nuevo comportamiento; comprobar build, ejecución y firma en macOS antes de declarar C5 cerrado. |

Se compararon **88 archivos rastreados** bajo `apps/studio/**`: **17** blobs idénticos y **71** diferentes; no hubo rutas sin antecedente tras normalizar nombres. Idénticos: **10** PNG de `AppIcon.appiconset`, `apps/studio/.gitignore`, `Assets.xcassets/Contents.json`, `AccentColor.colorset/Contents.json`, tres artefactos de workspace/Xcode (`contents.xcworkspacedata`, `WorkspaceSettings.xcsettings`, `Package.resolved`) y `scripts/ExportOptions.plist`. El cambio de marca en rutas y texto no equivale a una reimplementación.

## Recursos generados y alcance del inventario

El TSV cubre únicamente rutas rastreadas bajo `apps/studio/**`. Quedan documentados aparte:

| Recurso / dependencia | Rol activo | Inventario C4 |
| --- | --- | --- |
| `La Voz Misionera Studio/Resources/LaVozMisioneraCore.js` | Bundle IIFE para JavaScriptCore; se genera con `node apps/studio/js/build-core-bundle.mjs` desde `packages/core` | No rastreado en Git y ausente del TSV; debe generarse antes del build/test macOS |
| `packages/core` | Fuente del bundle y contratos de dominio | Dependencia del monorepo; procedencia parcial documentada en M7.7B9 |
| `packages/tokens` (`native.ts` → `DesignTokens.generated.swift`) | Tokens Swift generados | Fuera de `apps/studio/**`; los símbolos `GC*` todavía estaban activos al iniciar C4 |
| SPM (`Package.resolved`) | Cliente Supabase y dependencias transitivas | `supabase-swift` 2.53.0 y pins transitivos registrados en el lockfile |
| Frameworks Apple | SwiftUI, AppKit, PDFKit, JavaScriptCore y plataforma | `THIRD-PARTY / PLATFORM`; fuera del TSV |

Verificación 2026-10-07 en Windows: TSV ↔ `git ls-files apps/studio/**` = **88/88**; los SHA del working tree coinciden con `lvm_blob`.

## Límites de compatibilidad

- `Config/StudioDefaults.swift` conserva claves locales `gc.*`. Cambiarlas sin migración perdería preferencias de usuarios existentes; la limpieza de nombres debe conservar lectura de claves anteriores.
- Studio usa `SupabaseClient` directamente. C5 no moverá Auth ni contenido a otro producto ni cambiará la base; el ownership futuro sigue las decisiones B7/B8 y M8/M9.
- `js/entry.mjs` importa submódulos de core para evitar incluir el cliente de red en JavaScriptCore. Mantener esa frontera y verificar UTF-16 con caracteres no ASCII.
- No hay macOS/Xcode en este equipo Windows. Los checks de JS y tokens son ejecutables aquí; compilación Swift, interacción y notarización requieren un host macOS.

## Gate de C4 y orden de C5

**Gate C4:** inventario rastreado (`apps/studio/**`, 88 filas), clasificación por área, dependencias declaradas, bundle JS generado y límites de compatibilidad documentados. La reconciliación TSV ↔ Git y sus exclusiones están explícitas.

Para C5: (1) icono y recursos originales; (2) shell/identidad visible; (3) biblioteca y lector; (4) editor y borradores; (5) importación/exportación; (6) pruebas y build en macOS. Cada reemplazo debe conservar el comportamiento útil y registrar qué implementación se retiró.

Estado: **C4 cerrado como auditoría documental. Studio no se declara independiente y C5 permanece pendiente.**
