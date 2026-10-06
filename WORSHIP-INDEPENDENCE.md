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
| Shell y navegación | `WorshipNavigation.tsx` y `worship-navigation.css` sustituyen a `Navbar.tsx`; las rutas de `App.jsx` se conservan | Shell y navegación LVM implementados ✅. `SettingsCluster`, `SpriteAvatar`, avisos y los componentes de cada ruta conservan su implementación actual y se auditan en sus áreas | Rutas, menú móvil, estado activo, responsive y Service integration verificados en B1 |
| Dashboard | `WorshipDashboardPage.jsx` y `features/dashboard/` reemplazan a `HomeDashboardPage.jsx`; se retiraron sus once imágenes y estilos exclusivos | Dashboard LVM implementado ✅. Conserva acceso a biblioteca, repertorios, cancionero y búsqueda; usa un resumen propio del catálogo y estados de carga/vacío/error | Vista y rutas a 390/768/1024/1440 px; pruebas de datos, estados y navegación |
| Canciones y búsqueda | `SongsPage.jsx` y `SongViewPage.jsx` difieren; `useSongs.jsx` y parser ChordPro de `core` son idénticos | Conservar modelo funcional; reimplementar adaptadores propios de búsqueda, lectura y acordes por etapas | Canciones, acordes, transposición y búsqueda verificados |
| Editor de canción | `EditorPage.jsx` y `portal/EditorPage.jsx` difieren | Auditar campos y flujo antes de reemplazar; no confundir diff con autoría | Guardado, errores y permisos probados |
| Repertorios | `SetlistWorkspacePage.jsx` difiere; en `features/setlist` hay 18 archivos idénticos y 9 distintos | Conservar comportamiento y contrato con Service; reimplementar UI y lógica heredada por partes | Orden/repeticiones, export y handoff offline |
| Auth, perfil y ajustes | `LoginPage.jsx` y `ProfilePage.jsx` difieren; `useAuth.jsx` y `SpritePicker.jsx` son idénticos | Inventariar ahora; coordinar cambios de identidad/datos con M9 Auth | Sesión y datos de usuario compatibles |
| Worship Mode | `WorshipModePage.jsx` es idéntico | Reimplementar la experiencia conservando su función | Presentación y controles sin regresión |
| Service integration | `lvm/localSong.js`, `serviceAdapter.js` y `worshipPlan.js` tienen rutas nuevas | Conservar frontera y pruebas; revisar procedencia por módulo | Service → Worship → Service offline |
| Lecturas, publicaciones, admin y songbook | Las páginas principales difieren, pero dependen de componentes y core compartidos | Revisar ownership antes de reimplementar; contenido público/admin podría corresponder a LVM Service y Web Pública | Decisión de dominio por pantalla |
| Legal y licencias | Tres páginas legales sin ruta publicada; `/licenses` activo | Mantener páginas legales fuera hasta tener textos aprobados; continuar inventario de atribuciones | URLs, operador y avisos revisados antes de release |

Primera secuencia de implementación propuesta: shell/primitives → Dashboard → canciones y búsqueda → editor → repertorios → Worship Mode. Auth, lecturas, publicaciones y admin se abordan cuando su ownership y contratos estén claros. Ninguna fila se considera migrada solo por cambiar nombres, colores o hashes.

## M7.7B1 — Contrato de comportamiento del shell web

Antes del reemplazo, `App.jsx` renderiza una franja de anuncios no fija, una barra superior fija al desplazarse y el contenido de la ruta. Auth, recuperación de contraseña, Worship Mode y sesión en vivo tienen rutas sin esa barra. Los avisos y accesos auxiliares globales permanecen fuera de `Layout`.

- Escritorio: marca textual con retorno a inicio; accesos a inicio, canciones, repertorios, cancionero, lectura y publicaciones; acceso al portal editorial según rol; ajustes (tema, idioma, acordes); login o menú de cuenta.
- Móvil/tablet hasta 820 px: botón de menú y panel lateral con los mismos destinos principales, ajustes, estado offline y cuenta. Abre por botón, cierra por enlace, Escape o fondo; retiene el foco dentro y bloquea el scroll del documento mientras está abierto.
- Repertorios dirige a `/setlists` con sesión y a `/setlist` sin sesión. Las rutas `/setlists/*` comparten estado activo; canciones incluyen `/songs` y `/song/*`. Los accesos editor/admin se muestran solo con el rol correspondiente; el router sigue protegiendo esas rutas.
- Las URLs públicas y de integración no se renombran en B1. Dashboard, catálogo, editor, repertorios, lectura, posts y contratos LVM conservan sus componentes de ruta.

La implementación nueva debe expresar el estado activo con `aria-current`, ofrecer foco visible, conservar cierre/restauración de foco del panel móvil y dejar ajustes/cuenta disponibles sin copiar el antiguo `Navbar.tsx` ni sus reglas de menú/drawer.

### Cierre B1

- `WorshipNavigation.tsx` y su CSS son la nueva capa de navegación LVM. Los colores de marca se declaran en `packages/tokens/tokens.css` y el shell los consume sin duplicar valores. `App.jsx` conserva las rutas y monta el componente nuevo. El archivo heredado `Navbar.tsx` fue retirado, junto con sus reglas de barra, menú de usuario y bandeja de ajustes que ya no se usan.
- Las reglas `.gc-drawer` permanecen temporalmente porque `WorshipModePage.jsx` aún las utiliza para su panel de ajustes; se revisarán en B6. Los controles internos `SettingsCluster` y `SpriteAvatar` tampoco se declaran reimplementados en B1.
- El menú mantiene destinos, salida de invitado a `/setlist`, salida con sesión a `/setlists`, accesos por rol, ajustes y cuenta. `aria-current`, cierre con Escape, restauración del foco y bloqueo del scroll tienen pruebas específicas.
- Revisión de navegador en `/songs` a 390, 768, 1024 y 1440 px: `document.scrollWidth` coincide con el viewport; el menú móvil aparece hasta 1024 px y el menú de escritorio a 1440 px. A 390 px el panel mide 351 px, muestra seis destinos públicos y bloquea el scroll de fondo. La revisión usó credenciales de Supabase ficticias solo para renderizar el shell local; no certifica datos ni Auth reales.

## M7.7B2 — Dashboard de Worship Web

El Dashboard nuevo concentra la planificación musical: acceso a biblioteca, repertorios y cancionero; búsqueda enviada a la ruta existente `/songs?q=...`; y una selección de canciones del catálogo. La antigua portada con imagen, acciones aleatorias y publicaciones se retiró. Blog y Palabra del día siguen accesibles desde la navegación, sin incorporarlos al Dashboard mientras su ownership siga pendiente.

`features/dashboard/dashboardRepository.js` lee solo `slug`, `title`, `artist` y `default_key` de las primeras seis canciones no eliminadas, con conteo exacto de la biblioteca. La vista distingue respuesta vacía de error y permite reintentar. El hook original `useSongs` no se modificó; B3 auditará la biblioteca y su búsqueda.

En navegador local se revisó `/` a 390, 768, 1024 y 1440 px: tres accesos reales y búsqueda visibles, sin overflow horizontal. Las pruebas específicas cubren carga, error/reintento, vacío, datos, rutas y acceso a repertorios según sesión. La revisión visual utilizó configuración ficticia de Supabase y solo demuestra el render del Dashboard, no contenido remoto real.

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
