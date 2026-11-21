# Preparación musical conectada en Expo

## Alcance de la implementación

El cliente nativo incorpora un editor conectado adicional al intercambio de archivos. `/setlist/service` sin parámetros conserva el recorrido anterior de importar contexto y compartir WorshipPlan. Con `churchId` y `serviceId`, abre el editor conectado; `branchId` es opcional y, si falta, se usa una rama principal estable de ese ámbito. La cuenta procede exclusivamente de la sesión, nunca del enlace. Los identificadores incompletos, duplicados o inválidos no vuelven silenciosamente al modo de archivo.

El mapper reconoce también el enlace de Service `/setlist?churchId=…&serviceId=…`, preserva el ámbito durante el paso por autenticación y evita tratar `service` como un slug de canción compartida. Esto prepara la ruta dentro de Expo; no agrega una asociación universal del dominio del VPS ni distribuye un build activado.

La pantalla usa los componentes nativos existentes: selector de canciones, controles de orden, duplicación y tonos, archivos para compartir y botones del tema. Puede editar durante un envío. Muestra copia local, envío pendiente, entrega confirmada y conflicto; permite cancelar un envío pendiente ya detenido, actualizar el contexto y volver a revisar antes de enviar. Los eventos de reconexión/primer plano reintentan una operación pendiente sin conflicto, usando siempre su mismo UUID.

## Repositorio y aislamiento

`packages/core/src/setlists/worshipExchange.ts` no importa React Native ni DOM. Recibe almacenamiento, transporte autenticado, UUID y verificación del ámbito activo. `apps/mobile/src/lib/connectedWorship.ts` inyecta AsyncStorage para datos musicales y el transporte de dispositivo para HTTP. Las credenciales permanecen exclusivamente en SecureStore.

Cada registro `lvm.worship.connected.v1:[userId,churchId,serviceId,branchId]` contiene borrador, intercambio confirmado, generaciones locales, revisión local de almacenamiento y operación pendiente. La escritura es un único registro; el envío solo ocurre después de persistir el UUID, las revisiones esperadas y el snapshot musical. Una respuesta confirma esa operación sin sustituir las ediciones posteriores. Una revisión local creciente impide que la interfaz adopte un snapshot anterior a otro que ya recibió.

Los ciclos leer/modificar/escribir se serializan entre repositorios del mismo ámbito que comparten la instancia de almacenamiento en el runtime JavaScript. No se afirma exclusión mutua entre procesos nativos diferentes. El servidor conserva CAS, UUID idempotente y verificación de permisos como autoridad entre dispositivos.

Un HTTP 409 se conserva en el diario junto con el envío y el borrador; no se reintenta automáticamente ni se actualizan revisiones silenciosamente. Cancelar conserva las canciones. Los rechazos de permisos y errores de almacenamiento/red tampoco borran el trabajo. Cambiar cuenta, iglesia o culto remonta la pantalla y dispone el repositorio anterior; se abortan sus solicitudes y sus respuestas no confirman trabajo de otro ámbito. El encabezado `X-LVM-Account` vincula cada petición al actor esperado.

La primera carga recupera la propuesta existente mediante `draftFromWorshipPlan`, con el mismo serializador y validación de acordes UTF-16 que la web. Mantiene apariciones repetidas con IDs locales distintos y tonos separados, en lugar de comenzar una sustitución vacía. Las actualizaciones posteriores del contexto no sustituyen el borrador local. Si el snapshot remoto no puede convertirse sin pérdida, se rechaza la recuperación y no se sobrescribe el diario.

## Comprobación y trabajo pendiente

Las pruebas inyectadas cubren recuperación tras desconexión/reinicio, UUID persistido antes de HTTP, ediciones durante envío, respuestas invertidas, conflicto explícito, aislamiento por los cuatro identificadores, almacenamiento lleno, revocación, disposición y recuperación exacta de una propuesta repetida. Son comprobaciones del repositorio y de rutas; no prueban controles táctiles ni Keystore.

El 21 de noviembre pasaron 950 pruebas móviles en 87 archivos, el chequeo de tipos, las 546 pruebas web en 94 archivos y los exports Metro Android/iOS con el modo VPS seleccionado. Tras congelar el ámbito del repositorio se repitieron las 13 pruebas específicas y el chequeo de tipos. El build web completo pasó usando `LVM_CATALOG_URL=https://srv2137598.hstgr.cloud/api/data/songs` y el origen del VPS; no se proveyeron claves de Supabase. El chequeo de idiomas terminó sin diferencias: las claves nuevas tienen fuente inglesa y copia española; coreano y turco conservan placeholders ingleses y `needsReview: true`, sin reemplazar sus traducciones existentes ni atribuir revisión humana.

Faltan el selector nativo de iglesia/culto, la navegación de recuperación entre ramas, la comparación visual de propuestas concurrentes y la validación de las pantallas en dispositivo/emulador. También falta ejecutar este nuevo repositorio contra la API/PostgreSQL aislados; el preflight de autenticación anterior no se atribuye a este editor. La API nativa productiva sigue sin publicarse. Deben completarse esos recorridos antes de activar o distribuir el cliente; W1/W2/W3 nativos permanecen abiertos.
