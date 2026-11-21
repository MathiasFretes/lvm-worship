# Sesión de dispositivo para la migración Expo

Estado del 21 de noviembre: frontera de transporte implementada y comprobada en QA; todavía no reemplaza el cliente Expo actual ni se publicó en la API productiva.

`apps/mobile/src/lib/deviceTransport.ts` recibe un almacenamiento seguro y una implementación fetch. No importa módulos nativos, no usa AsyncStorage y solo envía el token opaco al HTTPS `/api` configurado. Rechaza otros orígenes y redirecciones, elimina cookies/Origin del transporte y llama a `/api/native/auth/…`. El token comparte usuarios y revocación de PostgreSQL con la web; no es un JWT interno de PostgREST.

Las operaciones de almacenamiento se serializan. Un login atrasado no puede recuperar una sesión después de logout; se comprueban expiración e identidad al recuperar el perfil. Una caída de red conserva la sesión no expirada para que el host pueda mantener material offline, sin otorgar permisos del servidor.

Cinco pruebas del transporte y el typecheck móvil pasaron. La suite móvil completa pasó 924 pruebas antes de añadir la quinta prueba de este transporte (no se presenta ese conteo como ejecución del último cambio). También pasó una prueba HTTP contra PostgreSQL/API aislados usando este transporte: misma cuenta web/nativa, lectura privada, cookie web sin token expuesto, rechazo de solicitudes nativas desde navegador y revocación por cambio de contraseña.

Para repetir el preflight, preparar la API aislada de Service y el túnel a `127.0.0.1:54319`; ejecutar desde Service `node --experimental-strip-types scripts/verify-native-session.mjs`. No acepta un destino productivo. El almacenamiento de esa comprobación es memoria: no prueba Keystore ni Keychain.

Antes de activar, integrar el almacenamiento del sistema, adaptar el cliente y el layout a restauración offline y revocación, y retirar controles de proveedores no configurados. Luego ejecutar exports Android/iOS y un recorrido nativo. La selección de almacenamiento seguirá la documentación de [Expo SecureStore SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/), compatible con el SDK fijado de la app; no se instala ni se activa todavía en esta entrega. No importar credenciales de Supabase ni guardar contraseñas.
