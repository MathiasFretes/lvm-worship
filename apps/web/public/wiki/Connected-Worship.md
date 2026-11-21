# Worship conectado y ensayo sin conexión

## Entrega publicada y verificada — 21 de noviembre de 2026

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

## Publicación y recuperación

Se publicaron coordinadamente API + migración aditiva `011_worship_exchange` + ambos clientes, con `VITE_SERVICE_WORSHIP=connected` en Service, en `https://srv2137598.hstgr.cloud`. Worship Web corresponde a `52d4454bd` y Service/API a `0c5e73e`. El flujo conectado pasó con los recursos HTTPS reales, seleccionando explícitamente la iglesia en Service, y la planificación anterior volvió a superar sus ocho escenarios de aceptación. Los fixtures temporales quedaron eliminados.

GitHub Actions aprobó los tres jobs del código de Service/API publicado en la [ejecución 44910644424](https://github.com/MathiasFretes/la-voz-misionera-platform/actions/runs/44910644424). Los tests de Worship y su ensayo offline se ejecutaron localmente; no se presentan como CI remoto de Worship.

El snapshot previo está en `/srv/apps/la-voz-misionera/releases/worship-20261121T134628Z`. Se restauró el respaldo posterior de PostgreSQL en una base desechable y se verificaron migración 011, permisos privados y propietario único. La copia fuera del VPS `lvm_worship_20261121T135208Z.dump.dpapi` pasó checksum y recuperación DPAPI. La reversión de interfaces/API conserva la migración aditiva y los datos musicales. No ejecutar migraciones históricas de Supabase. La entrega a la aplicación de escritorio de Presenter, los clientes nativos y la distribución continúan como gates separados.
