# M7.7B7–B8 — Ownership de identidad y contenido

Estado: decisión de arquitectura para la migración. **No cambia todavía Auth, rutas, esquema ni datos.**

## B7 — Identidad y acceso

**Decisión:** LVM Service será la fuente de verdad de identidad y acceso para la suite. Una persona tendrá una identidad central; su pertenencia a una iglesia o sede y sus permisos se evaluarán en el contexto de esa organización. Worship Web y Mobile consumirán sesión y capacidades otorgadas por la identidad central para operar sus dominios musicales. Presenter podrá funcionar localmente sin exigir una sesión en vivo.

| Concepto | Dueño futuro | Uso en Worship |
| --- | --- | --- |
| Usuario e identidad | LVM Service / Identidad | Referencia estable al usuario para borradores, canciones personales y repertorios |
| Sesión, login, logout y recuperación | LVM Service / Identidad | Cliente de la sesión compartida; login y callback pueden mantener rutas compatibles durante la transición |
| Iglesia, sede y membresía | LVM Service / Organización | Contexto de trabajo; Worship no crea una segunda tabla de miembros |
| Roles y permisos | LVM Service / Autorización | Capacidades explícitas como editar canción, revisar propuesta o administrar repertorios; la UI no es la única barrera |
| Perfil | LVM Service / Personas | Nombre y datos comunes; preferencias puramente musicales pueden permanecer en Worship |

### Estado encontrado

- Web: `apps/web/src/hooks/useAuth.jsx` se suscribe a `supabase.auth.onAuthStateChange`, carga `public.users` y toma `profile.role`; cachea perfil bajo `gc_profile_cache`. `LoginPage`, `SignupPage`, callbacks y recuperación llaman directamente a Supabase Auth. `WorshipNavigation` hace `supabase.auth.signOut()`.
- Autorización web: `RoleGuard`, `useRole` y `packages/core/src/rbac/roles` implementan la jerarquía `user < editor < admin < owner`. Rutas `/admin`, `/editor`, `/portal/editor`, `/portal/audit` y `/portal/posts` la consumen. `LvmSongEditorPage` y su repositorio usan rol e ID de actor; favoritos y repertorios personales usan sesión/usuario.
- Mobile: `apps/mobile/src/lib/authFlows.ts`, `authSession.ts`, `currentUser.ts`, `profile.ts` y `AccountScreen.tsx` contienen login/logout, recuperación y perfil ligados a Supabase. No hay evidencia en el flujo web inspeccionado de una entidad de membresía por iglesia que reemplace el rol global actual.
- Procedencia: el inventario M7.7A encontró `useAuth.jsx` idéntico al archivo de la ruta equivalente del origen comparado; `LoginPage.jsx` y `ProfilePage.jsx` difieren, lo que no acredita por sí solo autoría nueva. `SpritePicker.jsx` permanece idéntico. Se clasifican como implementación heredada o por revisar; B7 no los declara reemplazados.
- Rutas existentes a conservar temporalmente: `/login`, `/signup`, `/auth/callback`, `/forgot-password`, `/reset-password`, `/profile` y fallbacks `/app/auth/callback`, `/app/reset-password` para enlaces móviles.

### Regla de migración M8/M9

1. Definir `UserId`, `ChurchId`, `Membership` y un conjunto de capacidades antes de cambiar la UI. No asumir que `users.role` global representa permisos de varias iglesias.
2. Ofrecer a Web y Mobile un adaptador de sesión/capacidades; cambiar consumidores detrás de él, sin introducir otro sistema de usuarios en Worship.
3. Migrar IDs y perfiles con correspondencia verificable, conservar lectura de cuentas/rutas antiguas durante la transición y probar login, logout, refresh, recuperación, favoritos, canciones personales y repertorios.
4. Aplicar permisos en API/repositorio; un `RoleGuard` solo controla navegación. Retirar las políticas y claves antiguas únicamente cuando los datos y las sesiones existentes estén cubiertos.
5. Mantener fuera de publicación las páginas legales retiradas hasta confirmar operador y contacto, según la decisión anterior del proyecto.

## B8 — Contenido y publicación

**Decisión:** LVM Service / Contenido será dueño de los documentos editoriales y su estado de publicación. LVM Web Pública consumirá únicamente contenido publicado. LVM Worship será dueño de canciones, arreglos, repertorios y herramientas musicales; podrá enlazar o mostrar contenido aprobado a través de un contrato de lectura cuando aporte al flujo musical, sin administrar un CMS paralelo.

| Flujo actual | Evidencia | Destino y decisión |
| --- | --- | --- |
| Blog público `/posts`, `/posts/:slug` | `PostsPage`, `PostDetailPage`, `usePosts`; tabla `public.posts` con `draft/published`, slug, cuerpo, tags, autor | **Mover a Service / Contenido** el CRUD y publicación; **Web Pública** sirve listado y detalle. Conservar URLs o redireccionarlas cuando exista la nueva web. No borrar datos actuales. |
| Editor `/portal/posts*` | `ManagePostsPage`, `EditPostPage`, `PostEditor`; `RoleGuard` editor; RLS de `20260312_posts.sql` | **Mover a Service / Contenido** la edición, revisión y permisos. Retirar la UI de Worship solo tras reemplazo y migración de borradores/publicaciones. |
| «Palabra del día» web `/reading` | `ReadingsPage.tsx` usa plan bíblico y lector, no el CRUD `posts` | **Separar lectura bíblica de devocional editorial.** El plan y lector pueden ser una capacidad compartida de Biblia; Service / Contenido posee el devocional redactado. La ubicación final de `/reading` se decide con Web Pública y Mobile para no romper enlaces. |
| Devocionales Mobile | `apps/mobile/src/lib/devotionals/*`, `packages/core/src/devotional/*`; manifiesto/meses cacheados y pantallas de lectura | **Mover la fuente editorial a Service / Contenido** y publicar un feed versionado. Mantener caché offline, clave de día y emparejamiento con lecturas. No atribuir automáticamente el contenido histórico a LVM sin inventario de procedencia. |
| Reflexiones personales | `packages/core/src/reflections/*` y pantallas Mobile | **Separar del CMS público.** Son datos privados del usuario, sujetos a identidad/permiso y a la decisión de persistencia de M8/M9. No publicarlos por el feed editorial. |
| Anuncios del shell | `AnnouncementStrip` global | Servicio de comunicación de Service / Contenido en fase posterior; mantener el comportamiento actual hasta tener contrato y administrador reales. |

### Regla de migración M10–M13

1. Inventariar datos y assets reales por entidad, autor, estado, enlaces y derechos antes de copiar contenido histórico.
2. Definir `ContentRepository`/API de Service con borrador, publicación y lectura pública; una pantalla administrativa y la web pública deben consultar la **misma** fuente de verdad.
3. Migrar `posts`, devocionales y enlaces con trazabilidad; validar slugs, fechas, imágenes, permisos y redirecciones.
4. Mantener temporalmente las rutas de Worship o redirigirlas de forma explícita. No retirar `/posts` ni `/reading` mientras la nueva Web Pública no las cubra.
5. No copiar Supabase/Firestore ni la UI heredada como arquitectura nueva. Estos archivos son evidencia de comportamiento y datos a migrar.

### Rutas y retiro posterior

| Hoy | Ruta futura propuesta | Transición |
| --- | --- | --- |
| Worship `/posts` y `/posts/:slug` | Web Pública `/blog` y `/blog/:slug` | Mantener las URLs actuales con redirección estable y correspondencia de slugs tras migrar contenido. |
| Worship `/portal/posts*` | Service `/contenido/publicaciones*` | Retirar el editor duplicado de Worship únicamente cuando el CRUD y los permisos de Service estén probados. |
| Worship `/reading` | Web Pública `/palabra-del-dia` para el contenido editorial; lector bíblico compartido según el producto | Mantener `/reading` operativo o redirigido; no confundir plan de lectura con devocional. |
| Mobile `/devotional/:dayKey/:slug` | Contrato público de devocionales de Service; la ruta nativa puede conservarse | Migrar origen del feed sin perder caché y enlaces compartidos. |

**Qué se elimina de Worship después de la migración:** `ManagePostsPage`, `EditPostPage`, `PostEditor`, `usePosts`, la sección editorial de `EditorPage` y rutas `/portal/posts*`; las rutas públicas `/posts*` pasan a redirigir a Web Pública. También se retira cualquier carga editorial duplicada que quede en Worship. **Qué se conserva:** canciones, repertorios, Worship Mode, lectura bíblica útil al flujo musical y datos privados de reflexiones hasta que tengan repositorio dueño. No se eliminan documentos publicados, borradores, slugs ni assets antes de migrarlos y verificarlos.

## Fuera de alcance de B7/B8

No se crea login central, iglesia/membresía, API, CMS, web pública ni migración de datos en esta rama. Las decisiones fijan ownership para que M8/M9 y M12/M13 puedan implementarlos sin duplicar fuentes de verdad.
