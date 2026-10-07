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
| Canciones y búsqueda | `SongsPage.jsx` usa tarjeta, layout, estados y búsqueda LVM; `useSongs.jsx` expone error/reintento. `SongViewPage.jsx` y el parser ChordPro conservan su implementación actual | Biblioteca y búsqueda LVM ✅ (B3). La lectura, acordes y transposición se revisarán como un bloque separado; un hash distinto no prueba procedencia | Listado, búsqueda, filtros, rutas, pruebas y responsive verificados en B3 |
| Editor de canción | `features/song-editor/LvmSongEditorPage.jsx`, modelo y repositorio sustituyen el editor de portal y su variante móvil | Flujo principal LVM implementado ✅ (B4); lector/editor de ChordPro auxiliar, guía, preview y panel de revisión compartidos se conservan explícitamente | Crear, editar, ChordPro, errores, permisos, responsive y contrato Service verificados |
| Repertorios | `LvmSetlistEditor`, `LvmSongPicker` y `LvmSetlistsRail` sustituyen los cuatro controles visuales anteriores; `SetlistWorkspacePage` mantiene la orquestación y los hooks de persistencia existentes | Flujo central de repertorios LVM ✅ (B5). Persistencia compartida, exportadores, diálogos y atajos siguen inventariados para revisión posterior; no se declaran reimplementados | Crear, abrir, renombrar, agregar/repetir/quitar, ordenar, guardar y handoff offline verificados |
| Auth, perfil y ajustes | `useAuth.jsx`, rutas de acceso, `RoleGuard` y consumidores web/móvil inventariados | Ownership B7 decidido: LVM Service / Identidad; Worship consume sesión/capacidades. Implementación y datos actuales permanecen hasta M8/M9 | Migración de cuentas, membresía, sesiones y permisos sin pérdida de datos; [decisión](docs/m77-ownership-decisions.md) |
| Worship Mode | `WorshipModePage.jsx` anterior era idéntico | Pantalla, modelo de carga y estilos LVM implementados ✅ (B6); renderers compartidos, parser, catálogo, Biblia y KeySelector se conservan explícitamente | Navegación, acordes, tonalidad, versículos, reloj, temporizador, móvil y sesión comprobados |
| Service integration | `lvm/localSong.js`, `serviceAdapter.js` y `worshipPlan.js` tienen rutas nuevas | Conservar frontera y pruebas; revisar procedencia por módulo | Service → Worship → Service offline |
| Lecturas, publicaciones, admin y songbook | `/reading`, `/posts*`, `/portal/posts*`, devocionales Mobile y reflexiones inventariados | Ownership B8 decidido: Service / Contenido edita y publica; Web Pública muestra; Biblia/lecturas y reflexiones privadas se separan. Sin migración física en B8 | Fuente editorial única, enlaces y datos migrados; [decisión](docs/m77-ownership-decisions.md) |
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
- En B1 se conservaron temporalmente las reglas `.gc-drawer` que usaba Worship Mode. B6 sustituyó ese panel y retiró las reglas después de comprobar que no tenían otros consumidores JSX/TSX. `SettingsCluster` y `SpriteAvatar` tampoco se declaran reimplementados en B1.
- El menú mantiene destinos, salida de invitado a `/setlist`, salida con sesión a `/setlists`, accesos por rol, ajustes y cuenta. `aria-current`, cierre con Escape, restauración del foco y bloqueo del scroll tienen pruebas específicas.
- Revisión de navegador en `/songs` a 390, 768, 1024 y 1440 px: `document.scrollWidth` coincide con el viewport; el menú móvil aparece hasta 1024 px y el menú de escritorio a 1440 px. A 390 px el panel mide 351 px, muestra seis destinos públicos y bloquea el scroll de fondo. La revisión usó credenciales de Supabase ficticias solo para renderizar el shell local; no certifica datos ni Auth reales.

## M7.7B2 — Dashboard de Worship Web

El Dashboard nuevo concentra la planificación musical: acceso a biblioteca, repertorios y cancionero; búsqueda enviada a la ruta existente `/songs?q=...`; y una selección de canciones del catálogo. La antigua portada con imagen, acciones aleatorias y publicaciones se retiró. Blog y Palabra del día siguen accesibles desde la navegación, sin incorporarlos al Dashboard mientras su ownership siga pendiente.

`features/dashboard/dashboardRepository.js` lee solo `slug`, `title`, `artist` y `default_key` de las primeras seis canciones no eliminadas, con conteo exacto de la biblioteca. La vista distingue respuesta vacía de error y permite reintentar. El hook original `useSongs` no se modificó; B3 auditará la biblioteca y su búsqueda.

En navegador local se revisó `/` a 390, 768, 1024 y 1440 px: tres accesos reales y búsqueda visibles, sin overflow horizontal. Las pruebas específicas cubren carga, error/reintento, vacío, datos, rutas y acceso a repertorios según sesión. La revisión visual utilizó configuración ficticia de Supabase y solo demuestra el render del Dashboard, no contenido remoto real.

## M7.7B3 — Biblioteca y búsqueda de canciones

`SongsPage.jsx` conserva las rutas `/songs` y `/song/:id`, las preferencias de idioma, filtros por tags/comunidad, canciones personales y navegación por teclado. Usa una tarjeta y estilos propios de LVM. La búsqueda normaliza tildes y letras Unicode; la opción de buscar en letras usa `chordpro_content` ya cargado, sin solicitudes por canción a archivos estáticos. Las canciones personales siguen viniendo del repositorio compartido y la lista no incluye su letra completa, por lo que esa opción se limita a las letras disponibles en el catálogo.

`useSongs.jsx` mantiene la forma de datos que necesitan el lector, repertorios y WorshipPlan, pero ahora distingue errores de resultados vacíos y ofrece reintento. El lector `SongViewPage.jsx`, el modelo de agrupación y el parser ChordPro no se declaran reimplementados en B3. Sus rutas y pruebas siguen funcionando; su procedencia y reemplazo se revisan aparte.

El gate local de B3 cubre 410 pruebas web, lint e i18n; Vite compila. `npm run build` ejecuta además la generación SEO, que requiere `VITE_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` reales, no presentes en este entorno. No se cambió ese pipeline ni se introdujeron secretos. En navegador local, con respuestas de catálogo simuladas, `/songs` muestra dos canciones a 390 y 1440 px sin overflow; a 768 y 1024 px también se comprobó el ancho sin overflow. Esa revisión no certifica el backend remoto.

## M7.7B4 — Editor de canción

El editor anterior repartía el formulario entre `portal/EditorPage.jsx`, `MobileEditorPage.jsx` y controles separados. El nuevo `features/song-editor/` usa un solo formulario y un repositorio explícito para crear, actualizar por UUID, guardar borradores personales y enviar sugerencias según rol. Conserva las rutas `/portal/editor` y `/portal/editor/:slug`, los campos de canción, importación ChordPro, inserción de acordes y secciones, preview, revisión editorial y adjuntos PPTX. El guardado no cambia `Service 0.1` ni `WorshipPlan 0.1`.

La validación local exige título, tonalidad y tags; comprueba BPM y URL/ID de YouTube. Al editar una canción, el repositorio actualiza por UUID y busca un slug libre cuando cambia el título, para no sobrescribir otra canción. El formulario distingue carga, ausencia, error y cambios sin guardar. El importador ChordPro conserva cuerpo y directivas de secciones. El campo histórico `gracetracks_url` no se edita en la nueva pantalla: su compatibilidad de datos sigue pendiente del inventario de identidad. No se eliminó del modelo ni de la base.

El preview, la guía ChordPro, el panel de sugerencias, `@lavozmisionera/core` y el Worker PPTX son dependencias conservadas. No se atribuyen a la nueva implementación del editor; se revisarán con sus áreas respectivas. La interfaz nueva de PPTX mantiene el protocolo del Worker existente. La prueba de navegador de crear/editar usa Supabase simulado y comprueba las peticiones y la navegación; no certifica permisos RLS ni datos remotos. Se revisaron 390, 768, 1024 y 1440 px sin overflow horizontal.

## M7.7B5 — Repertorios

La nueva interfaz central permite crear y abrir repertorios, cambiar el nombre, buscar canciones, agregarlas tantas veces como requiera el orden musical, cambiar tonalidades, ordenar con botones accesibles, quitar solo una aparición y ver los estados de vacío, carga, error y guardado. Se reemplazaron `SetHeader`, `SetTable`, `SetlistsRail` y `LibraryRail` por componentes LVM. El estado del repertorio sigue usando los hooks de borrador local y persistencia Supabase existentes; se añadió `addSong` para que agregar una repetición nunca quite una canción. Los exportadores, diálogos, atajos y migración de borradores antiguos permanecen conectados a la página actual. Esto preserva funciones valiosas sin atribuir al nuevo código toda la infraestructura compartida.

El borrador conserva su contenido en este dispositivo. Los repertorios de una cuenta se guardan con debounce mediante el repositorio actual. La interfaz ahora muestra «Guardando» durante ese debounce y distingue un fallo de guardado de un fallo de carga. La prueba con cliente Supabase simulado comprueba las filas `setlist_songs`, sus posiciones, claves y apariciones repetidas; otra comprueba que el contexto de Service produce un `WorshipPlan 0.1` con el orden real. Los tests de contrato ya comprueban el arreglo de secciones, tildes, acordes y rechazo de versículos en WorshipPlan. La revisión en navegador a 390, 768, 1024 y 1440 px usó catálogo simulado y no mostró overflow horizontal. La suite web cerró con 429 pruebas y el E2E offline de LVM Service → Worship → LVM Service pasó con el nuevo editor de repertorios. Esto no verifica permisos ni persistencia en una base remota.

## M7.7B6 — Worship Mode

La nueva `WorshipModePage.jsx` reemplaza la pantalla heredada y separa la transformación de canciones/versículos en `worshipModeModel.js` y el layout en `worship-mode.css`. Conserva la ruta `/worship/:songIds?`, el retorno al repertorio, la secuencia con apariciones repetidas, tonalidades por posición y recuperación de sesión. La pantalla ofrece letra y acordes, transposición por tono/semitono, selección y restauración de clave, cambio de canción por botones/teclado/swipe, columnas en escritorio, tamaño de letra, reloj, temporizador, tema, pantalla completa y búsqueda para añadir canciones. En móvil, los controles secundarios aparecen en un panel inferior y el gesto vertical evita la zona superior de refresco.

Se conservan de manera explícita `ChordRender`, el parser ChordPro, `KeySelector`, el catálogo de canciones, la API de capítulos bíblicos y los tokens globales existentes. Esas dependencias compartidas **no** se declaran reimplementadas por B6. La carga de versículos sigue siendo una consulta de la fuente bíblica actual; si falla, las demás canciones del repertorio continúan disponibles. Los archivos nuevos no contienen el antiguo `TitleStrip` ni el drawer de Worship Mode basado en `.gc-drawer`.

El gate de B6 incluye las pruebas existentes de Worship Mode, una prueba nueva del cierre accesible del panel y pruebas del modelo para orden/repeticiones, claves y sesión, lint y Vite build. La revisión visual cubre 390/768/1024/1440 px sin desbordamiento. Esto verifica el flujo local y los datos simulados de las pruebas; no certifica el catálogo remoto ni permisos de Supabase.

## M7.7B7–B8 — Decisiones de ownership

[El inventario y las decisiones formales](docs/m77-ownership-decisions.md) asignan User/Session/Membership/Roles/Profile a LVM Service / Identidad. Worship Web/Mobile consume esa identidad para sus operaciones musicales; no crea usuarios o permisos paralelos. Blog, posts y devocionales editoriales se asignan a LVM Service / Contenido; Web Pública publica los documentos aprobados. El plan/lector bíblico se separa del contenido redactado y las reflexiones privadas no entran en el CMS público. B7/B8 son decisiones y plan de migración: no cambian rutas, autenticación, datos ni esquema en esta rama.

## M7.7B9–C2 — Núcleo compartido y Mobile

- [B9: auditoría del núcleo compartido](docs/m77-b9-shared-core-audit.md) clasifica ChordPro, transposición, render, canciones, setlists, hooks y adaptadores. 49 de 55 archivos de `packages/core` coinciden exactamente con el árbol de referencia en la misma ruta; esa base no se declara reimplementada.
- [C1: auditoría Mobile](docs/m77-c1-mobile-audit.md) cubre rutas, funciones, assets, dependencias y duplicación Web/Mobile. El layout original de cinco tabs coincide como blob; se sustituyó su capa de navegación conservando Expo NativeTabs y destinos.
- C2 comenzó con una regla nueva de búsqueda en `packages/core/src/songs/search.ts`, consumida por Mobile, y un modelo Mobile explícito de fusión catálogo/borradores. El modelo de biblioteca agrupa, ordena y busca con pruebas, y la vista existente lo consume. El detalle de canción usa un nuevo selector puro de tonalidad. La pestaña de repertorios tiene una nueva orquestación de lista sin cambiar el repositorio ni el builder. La UI de biblioteca/detalle y el builder siguen siendo **MIXED**; C2 no se declara terminado hasta completar esas piezas y sus gates.
- La comparación por blob es evidencia de igualdad de contenido, no una conclusión legal sobre propiedad. Los assets móviles coincidentes y el `assets/icon.png` ausente siguen como gates de independencia/release.

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
