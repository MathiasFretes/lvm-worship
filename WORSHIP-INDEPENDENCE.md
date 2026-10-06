# M7.7 — Independencia de LVM Worship

Estado: en curso. Esta rama no acredita todavía una implementación totalmente original.

## Evidencia verificada

- `MathiasFretes/lvm-worship` está separado como repositorio de GitHub. Eso no describe por sí solo el origen de cada archivo.
- La comparación de blobs documentada en `1ec78cf` encontró, sobre 1.180 archivos rastreados entonces, 690 archivos idénticos a `rwm6857/GraceChords` en la misma ruta, 400 distintos en rutas compartidas y 90 rutas nuevas. La comparación precede al commit WIP `2e64202`; debe repetirse tras las migraciones. Una ruta nueva o un hash distinto no prueban autoría original.
- `apps/web/src/lvm/localSong.js`, `serviceAdapter.js` y `worshipPlan.js`, junto con sus pruebas y fixtures, no tenían equivalente en la misma ruta del origen. Forman el puente específico de LVM con Service.
- Hay coincidencias en componentes activos de web y móvil, `packages/core`, iconos, splash y sprites. Los nombres de paquetes LVM y la eliminación de la etiqueta *fork* no cambian la procedencia del código o los gráficos.
- **Licencia de LVM Worship: no determinada por este repositorio.** No hay archivos `LICENSE` ni `NOTICE` rastreados en su raíz y la API de GitHub no informa una licencia para `MathiasFretes/lvm-worship`. Los archivos Apache-2.0 y `NOTICE` enlazados abajo pertenecen exclusivamente al repositorio externo `rwm6857/GraceChords`; son evidencia de ese repositorio, no una declaración de licencia de LVM Worship. Cualquier obligación relativa a código o assets que se hayan conservado requiere una revisión de procedencia por archivo.

## Estado de la rama actual

`2e64202` retiró el inventario anterior, documentos legales, el listado y generador de licencias de terceros, algunos assets y varios módulos aún importados. La reparación mínima de esta rama restablece build, tests y licencias de dependencias; los puntos siguientes siguen abiertos:

- `npm run build` de vista previa, `npm run lint` y las 396 pruebas web vuelven a pasar. `/licenses` usa un inventario regenerable de dependencias. Este listado no sustituye los avisos del código de origen ni de los assets.
- `/privacy`, `/terms` y `/delete-account` quedan fuera del enrutador y de la generación SEO por decisión del responsable del proyecto, hasta definir operador y contacto. No se restauraron las declaraciones legales falsas. La app móvil todavía enlaza a esas URLs; ninguna release web/móvil debe salir con esa incoherencia.
- `SongViewPage` ya no muestra el enlace de pistas roto. El modelo todavía conserva `gracetracks_url`; su migración requiere una decisión explícita y compatibilidad de datos.
- `apps/mobile/app.json` aún señala `assets/icon.png`, eliminado por el WIP. Los splash y sprites restantes siguen pendientes de reemplazo con procedencia LVM.
- Las pantallas de acceso siguen cargando `gc-brand-wide-*.svg`. Los tokens `--gc-*`, `createGcSupabase` y las claves persistidas `gc.*` siguen en rutas activas. Deben migrarse con compatibilidad para no perder datos.
- Las páginas legales eliminadas afirmaban que Ryan Moore operaba La Voz Misionera. No deben restaurarse con esa atribución. El operador, contacto y prácticas de datos reales deben confirmarse antes de publicar nuevos textos.

## M7.7A — Inventario por función

Comparación realizada sobre `f659708` contra el árbol público `rwm6857/GraceChords` `main` (`5cb40d2`, 6 de octubre de 2026). Se compararon hashes de blobs **en la misma ruta**. `Idéntico` prueba igualdad de contenido; `diferente` o `ruta nueva` no prueban que el archivo sea original de LVM. Las cifras incluyen pruebas y recursos auxiliares, no solo código ejecutado.

| Área | Archivos LVM | Idénticos | Diferentes | Rutas nuevas |
| --- | ---: | ---: | ---: | ---: |
| `apps/web/src` | 339 | 202 | 130 | 7 |
| `apps/web/public` | 87 | 60 | 27 | 0 |
| `packages/core` | 55 | 49 | 6 | 0 |
| `apps/mobile/src` | 350 | 222 | 128 | 0 |
| `apps/mobile/assets` | 25 | 24 | 1 | 0 |

Los siete archivos de ruta nueva en `apps/web/src` están bajo `lvm/` y comprenden tres módulos de contrato y cuatro pruebas/fixtures. Esta observación se limita a la ruta y al contenido comparado; la procedencia de cada implementación se revisa por separado.

| Función web activa | Evidencia concreta | Decisión M7.7 | Siguiente gate |
| --- | --- | --- | --- |
| Shell y navegación | `App.jsx` y `Navbar.tsx` difieren; `layout-kit/Button.jsx` y `Card.jsx` son idénticos | Conservar rutas y UX valiosa; reimplementar primitives y shell visual con identidad LVM | Navegación y estados a 390/768/1024/1440 px |
| Dashboard | `HomeDashboardPage.jsx` difiere; varios recursos visuales públicos coinciden | Rehacer presentación y sustituir assets; conservar los flujos útiles | Estado vacío/carga/error y rutas reales |
| Canciones y búsqueda | `SongsPage.jsx` y `SongViewPage.jsx` difieren; `useSongs.jsx` y parser ChordPro de `core` son idénticos | Conservar modelo funcional; reimplementar adaptadores propios de búsqueda, lectura y acordes por etapas | Canciones, acordes, transposición y búsqueda verificados |
| Editor de canción | `EditorPage.jsx` y `portal/EditorPage.jsx` difieren | Auditar campos y flujo antes de reemplazar; no confundir diff con autoría | Guardado, errores y permisos probados |
| Repertorios | `SetlistWorkspacePage.jsx` difiere; en `features/setlist` hay 18 archivos idénticos y 9 distintos | Conservar comportamiento y contrato con Service; reimplementar UI y lógica heredada por partes | Orden/repeticiones, export y handoff offline |
| Auth, perfil y ajustes | `LoginPage.jsx` y `ProfilePage.jsx` difieren; `useAuth.jsx` y `SpritePicker.jsx` son idénticos | Inventariar ahora; coordinar cambios de identidad/datos con M9 Auth | Sesión y datos de usuario compatibles |
| Worship Mode | `WorshipModePage.jsx` es idéntico | Reimplementar la experiencia conservando su función | Presentación y controles sin regresión |
| Service integration | `lvm/localSong.js`, `serviceAdapter.js` y `worshipPlan.js` tienen rutas nuevas | Conservar frontera y pruebas; revisar procedencia por módulo | Service → Worship → Service offline |
| Lecturas, publicaciones, admin y songbook | Las páginas principales difieren, pero dependen de componentes y core compartidos | Revisar ownership antes de reimplementar; contenido público/admin podría corresponder a LVM Service y Web Pública | Decisión de dominio por pantalla |
| Legal y licencias | Tres páginas legales sin ruta publicada; `/licenses` activo | Mantener páginas legales fuera hasta tener textos aprobados; continuar inventario de atribuciones | URLs, operador y avisos revisados antes de release |

Primera secuencia de implementación propuesta: shell/primitives → Dashboard → canciones y búsqueda → editor → repertorios → Worship Mode. Auth, lecturas, publicaciones y admin se abordan cuando su ownership y contratos estén claros. Ninguna fila se considera migrada solo por cambiar nombres, colores o hashes.

## Decisiones por área

| Área | Dueño futuro | Decisión | Condición de cierre |
| --- | --- | --- | --- |
| Contratos WorshipPlan 0.1 y Service 0.1 | LVM Worship / LVM Service | Conservar comportamiento y frontera | E2E offline Service → Worship → Service |
| Catálogo, editor, setlists, lector y componentes compartidos | LVM Worship | Inventariar rutas activas y reimplementar por verticales | Código y pruebas de cada vertical revisados; web y móvil compilan |
| Assets de marca, iconos, splash y sprites | Identidad LVM | Sustituir con archivos de procedencia documentada | Web, móvil y Studio usan assets LVM verificados |
| Licencia y avisos de LVM Worship | Responsable del producto | Definir expresamente la licencia propia y revisar por separado los avisos aplicables al material conservado | Decisión documentada e inventario de procedencia antes de distribución |
| Privacidad, términos y eliminación de cuenta | Responsable del servicio | Redactar con operador y datos reales; conservar rutas públicas | Contenido aprobado y URLs con HTTP 200 |
| Identificadores `gc.*`, `--gc-*`, `createGcSupabase`, `gracetracks_url` | LVM Worship | Migración gradual y compatible | Sin pérdida de datos ni enlaces inválidos |

## Orden de ejecución

1. Confirmar operador y contacto, redactar los textos legales y volver a habilitar las rutas públicas y los enlaces móviles solo cuando el contenido esté aprobado.
2. Definir la licencia de LVM Worship y completar el inventario de procedencia y avisos del material conservado; el listado actual solo cubre paquetes instalados.
3. Sustituir los assets heredados con procedencia propia; comprobar web, Android, iOS y Studio.
4. Reimplementar una vertical funcional por vez, conservando contratos y pruebas de comportamiento.
5. Migrar identificadores técnicos con lectura de claves antiguas y escritura de nuevas; retirar el camino viejo solo después de verificar datos existentes.
6. Repetir comparación de procedencia, pruebas, builds y revisión de avisos. Recién entonces evaluar el objetivo de implementación propia.

No declarar M7.7 cerrado ni publicar una release desde esta rama mientras fallen los gates anteriores.

## Referencias

- [Código de origen](https://github.com/rwm6857/GraceChords)
- [Licencia del origen](https://github.com/rwm6857/GraceChords/blob/main/LICENSE)
- [Aviso del origen](https://github.com/rwm6857/GraceChords/blob/main/NOTICE)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
