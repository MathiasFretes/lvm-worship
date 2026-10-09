# M7.7C5 — Studio Migration / Cleanup

Fecha: 2026-10-07. Rama: `claude/m77-worship-independence-audit`.

## Cambios ejecutados

### Identidad y assets

- Se creó una fuente vectorial LVM propia en `apps/mobile/assets/lvm-mark.svg`.
- `apps/mobile/assets/icon.png` se genera a 1024×1024 desde esa fuente.
- Los diez PNG de `AppIcon.appiconset` fueron regenerados; ya no son byte-idénticos a la referencia histórica.
- `apps/studio/js/generate-appicon.mjs` permite regenerar Mobile y Studio en Windows/macOS mediante `npm run studio:icons`.
- El generador Swift existente sigue disponible para validar la composición nativa en macOS.

### Design tokens y shell

- Los símbolos Swift generados y sus consumidores migraron de `GC*` a `LVM*`.
- La extensión de tipografía pasó de `.gcTextStyle` a `.lvmTextStyle`.
- `packages/tokens/generate-swift.mjs` es la única fuente del espejo Swift; `DesignTokens.generated.swift` no se mantiene a mano.
- Shell, biblioteca, visor, editor e importación consumen los nombres LVM regenerados.

### Preferencias compatibles

- Studio escribe preferencias nuevas bajo `lvm.*`.
- `StudioDefaults` y `ViewerPrefs` conservan lectura de `gc.*` y copian valores existentes al namespace LVM.
- Las claves históricas no se eliminan, para permitir rollback sin pérdida.
- Se añadieron tests Swift de migración al target existente.

### Dominio compartido

- No se duplicó ChordPro, transposición, lint, RBAC ni PDF import en Swift.
- El bundle JavaScriptCore fue regenerado desde `packages/core` y pasó las comparaciones de parser, render, transposición, edición, lint, roles, slug y offsets UTF-16.
- Auth, Supabase, tablas y RLS permanecen sin cambios; su ownership futuro sigue fuera de C5.

## Evidencia ejecutada en Windows

- `npm run studio:icons`.
- `npx --yes node@22.23.0 packages/tokens/generate-swift.mjs --check`.
- `node apps/studio/js/build-core-bundle.mjs`.
- `node apps/studio/js/verify-bundle.mjs`: **ALL CHECKS PASSED**.
- Búsqueda activa: sin símbolos `GCColor`, `GCSpacing`, `GCTextSpec`, `GCTypeScale` ni `.gcTextStyle`.
- Las únicas claves `gc.*` restantes en Swift son las constantes de lectura legacy.
- Comparación posterior en `m77-c5-studio-provenance.tsv`: 36 rutas cambiaron desde C4, 45 siguen en revisión sin cambios y 7 continúan idénticas a la referencia por ser configuración genérica (`.gitignore`, workspace/lockfile, catálogos base y `ExportOptions.plist`).
- Los **10/10 PNG** de AppIcon difieren ahora de sus blobs de referencia.

## Resultado por vertical

| Vertical | Resultado C5 |
| --- | --- |
| Assets / identidad | Sustituidos por fuente y AppIcon LVM regenerables |
| Shell / navegación | Migrado a tokens y namespace LVM; comportamiento útil conservado |
| Biblioteca / lector | Consumidores migrados a tokens LVM; dominio compartido preservado |
| Editor / borradores | Consumidores migrados; ChordPro y draft recovery conservados |
| Importación / exportación | Consumidores migrados; contratos y servicios conservados |
| Preferencias | Escritura `lvm.*` con lectura/migración `gc.*` |
| Bridge JS/Swift | Regenerado y verificado |

## Gates macOS pendientes

Este host Windows no puede acreditar:

- compilación del target Swift;
- ejecución de los tests Xcode, incluidos los nuevos tests de migración;
- inspección visual del AppIcon en Finder/Dock;
- Auth/Keychain, importación PDF y exportación PDF/JPG;
- firma y notarización.

Estado: **migración C5 ejecutada en código y assets; validación nativa macOS pendiente. No se declara Studio distribuible desde Windows.**

La comparación inicial posterior a C5 no convertía un hash distinto en prueba de
autoría y dejó 45 rutas `UNCHANGED_REVIEW_REQUIRED` como deuda explícita.

## Segunda pasada de runtime activo

Se reimplementaron 13 rutas Swift activas que seguían con el blob C4: estado de
Auth, registro tipado del bridge y DTOs con validación UTF-16, proyecciones y
payloads PostgREST, repositorios, composición de servicios y transporte de
exportación. Los nombres de tablas/columnas, filtros RLS, JSON del bridge y APIs
consumidas por SwiftUI se conservaron. Estas filas figuran como
`ACTIVE_RUNTIME_REIMPLEMENTED` en el TSV; quedan 32 filas
`UNCHANGED_REVIEW_REQUIRED` fuera de esta pasada.

En Windows volvieron a pasar la generación y verificación completa del bundle
(`ALL CHECKS PASSED`, incluidas 144 comparaciones de render y casos UTF-16), el
check de tokens generados y `git diff --check`. No hay toolchain Swift/Xcode en
este host, por lo que siguen pendientes en macOS: compilar el target, ejecutar
`La Voz Misionera StudioTests` (incluidos los contratos nuevos), probar
Auth/Keychain y Supabase contra RLS, y verificar exportación PDF/JPG y firma.

## Revalidación del árbol local

El TSV de C5 representa el checkpoint de esa migración, no el hash del árbol
actual después de la pasada posterior de ownership D1. En la comprobación del
2026-10-07, 32 de sus rutas tenían un blob local posterior y dos rutas estaban
retiradas. Comparando **el contenido actual** de las 88 rutas del inventario C4
con sus blobs de referencia: 79 difieren, 7 son configuración/artefactos genéricos
idénticos y 2 están ausentes. Los diez PNG de AppIcon difieren de la referencia.
Un hash distinto acredita un cambio de contenido, no autoría ni funcionamiento.

En este mismo árbol pasaron `npm run typecheck -w @lavozmisionera/mobile`,
`npm run i18n:check -w @lavozmisionera/mobile`, 902 tests móviles,
los exports JS de Android e iOS,
`node apps/studio/js/verify-bundle.mjs` y el check de tokens con Node 22.23.
La compilación y los tests Swift continúan pendientes de un host macOS.
