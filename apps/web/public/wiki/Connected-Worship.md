# Worship conectado y ensayo sin conexión

## Entrega local verificada — 21 de noviembre de 2026

Service conserva la administración general. El enlace de preparación abre `/setlist?churchId=...&serviceId=...` con la misma sesión HttpOnly. Worship recibe únicamente el contexto musical y los permisos actuales de la API. La revisión e incorporación al orden completo siguen en Service.

Los borradores y sus operaciones se separan por cuenta, iglesia, culto y rama local. Abrir un borrador conserva la copia anterior. Si hay varias ramas, el usuario elige cuál recuperar; no se decide por una marca de tiempo ni se reemplazan ediciones entre pestañas. Una propuesta remota se abre explícitamente mediante «Editar: Repertorio para LVM Service», creando otra rama sin modificar el borrador actual.

La recuperación usa las secciones ejecutadas de la propuesta, incluidos repeticiones, tonos y posiciones UTF-16 de acordes, sin consultar el catálogo. El orden expandido se renumera secuencialmente en la copia editable; las secciones de la canción original que no estaban en la propuesta no se inventan. Si una letra contiene sintaxis ChordPro que impide convertirla fielmente, la apertura se rechaza y conserva tanto el servidor como el borrador anterior.

Antes de enviar se guarda la solicitud completa con su UUID y ambas revisiones. Reconectar o reabrir reintenta esa misma operación; una respuesta antigua no reemplaza las entradas del editor. Un HTTP 409 conserva la propuesta local y exige cancelar el envío pendiente y actualizar explícitamente el contexto antes de enviar otra versión. La cancelación no elimina el repertorio.

El ensayo offline descarga una instantánea con letras, acordes, lecturas, notas y canciones privadas en IndexedDB. El permiso local permite leer material descargado; nunca concede roles ni acceso remoto. Cerrar sesión o cambiar de cuenta revoca ese acceso. El service worker almacena recursos estáticos y la pantalla, nunca respuestas de `/api/`.

## Evidencia

- Web: 546 pruebas aprobadas en 94 archivos; lint sin errores. Build de VPS con `LVM_CATALOG_URL`, `VITE_API_URL` y `VITE_SITE_URL` aprobado.
- `apps/web/scripts/verify-offline-rehearsal.mjs`: Chromium sobre build productivo, service worker real, descarga desde la interfaz, recarga sin conexión, lecturas/notas/tonos repetidos/canción privada, ancho móvil y revocación al cambiar de cuenta.
- Service `scripts/verify-worship-connected.mjs`: assets productivos de ambos clientes y API/PostgreSQL aislados, sesión real de músico, guardado pendiente tras recarga, reconexión, revisión administrativa, incorporación conservando bienvenida manual, conversión canónica de Presenter y recuperación desde otro contexto del navegador. Limpia los fixtures al terminar.
- La prueba conectada bloquea los PUT musicales para simular la interrupción; no sustituye la prueba separada del service worker ni demuestra entrega al proceso de escritorio de Presenter.

## Publicación pendiente

Esta evidencia corresponde a cambios locales, no al CI de `6301397` ni a una publicación productiva. Publicar coordinadamente API + migración aditiva `011_worship_exchange` + ambos clientes, habilitando `VITE_SERVICE_WORSHIP=connected` en Service. Conservar respaldos de PostgreSQL, API y ambas compilaciones; comprobar HTTPS y los flujos publicados antes de registrar el cierre. No ejecutar migraciones históricas de Supabase.
