# Sesión de dispositivo para la migración Expo

Estado del 21 de noviembre: transporte, almacenamiento seguro y cliente Expo integrados detrás de `EXPO_PUBLIC_LVM_API_URL`; la API nativa sigue sin publicarse y no se activó ningún build distribuido.

`apps/mobile/src/lib/deviceTransport.ts` recibe un almacenamiento seguro y una implementación fetch. No importa módulos nativos, no usa AsyncStorage y solo envía el token opaco al HTTPS `/api` configurado. Rechaza otros orígenes y redirecciones, elimina cookies/Origin del transporte y llama a `/api/native/auth/…`. El token comparte usuarios y revocación de PostgreSQL con la web; no es un JWT interno de PostgREST.

Las operaciones de almacenamiento se serializan. Un login atrasado no puede recuperar una sesión después de logout; se comprueban expiración e identidad al recuperar el perfil. Una caída de red conserva la sesión no expirada para que el host pueda mantener material offline, sin otorgar permisos del servidor.

Cinco pruebas del transporte, el typecheck móvil y la suite móvil completa de 925 pruebas pasaron. Los exports Metro Android/iOS también pasaron, sin constituir un build nativo instalado ni probar el nuevo transporte desde las pantallas (todavía no está activado). También pasó una prueba HTTP contra PostgreSQL/API aislados usando este transporte: misma cuenta web/nativa, lectura privada, cookie web sin token expuesto, rechazo de solicitudes nativas desde navegador y revocación por cambio de contraseña.

Para repetir el preflight, preparar la API aislada de Service y el túnel a `127.0.0.1:54319`; ejecutar desde Service `node --experimental-strip-types scripts/verify-native-session.mjs`. No acepta un destino productivo. El almacenamiento de esa comprobación es memoria: no prueba Keystore ni Keychain.

## Integración optativa en Expo

La variable comentada en `apps/mobile/.env.example` selecciona exclusivamente el cliente VPS. Si es inválida, se muestra el error de configuración; no se vuelve silenciosamente a Supabase. Sin esa variable, los builds existentes conservan su modo anterior durante la transición.

Se instaló `expo-secure-store ~55.0.18` compatible con SDK 55 y se añadió su plugin sin reescribir los intent filters de `app.json`. Se usa almacenamiento cifrado del dispositivo con accesibilidad `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, según [Expo SecureStore SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/). La credencial persistida incluye token, vencimiento e identidad mínima; las listas de membresías permanecen fuera del ítem cifrado y se consultan al servidor. No se guardan contraseñas ni se importan sesiones anteriores.

`deviceBackend.ts` reutiliza el cliente de datos del core, adapta la sesión y coordina las notificaciones del layout. El arranque offline recupera solamente credenciales no vencidas. Un fallo de red no borra la sesión y el logout la elimina localmente aun sin Internet; revocarla en el servidor requiere que la petición llegue o que venza. La validación al primer plano detecta revocaciones. El cambio de contraseña conserva la sesión nueva que devuelve el VPS, donde ya se revocaron las anteriores; no ejecuta después un logout que borre esa nueva sesión.

Los controles Google/Apple y recuperación por correo se ocultan en modo VPS porque la API no los soporta. Las solicitudes de exportación pasan por el transporte del VPS y no pueden enviar su token opaco al antiguo dominio. Los endpoints de exportación todavía requieren su migración funcional; el enrutamiento seguro no equivale a implementarlos.

Pasaron 929 pruebas en la suite móvil completa, el typecheck y ambos exports Android/iOS con el modo VPS seleccionado. Después se añadió y aprobó una prueba adicional de logout exclusivamente local: las tres pruebas actuales del adaptador pasan y comprueban que esa operación no envía credenciales y que pedir logout de otras sesiones no borra la sesión actual. No se atribuye el conteo de la ejecución anterior a esa prueba nueva.

Todavía se requiere instalar una nueva compilación nativa que incluya SecureStore y probar login, lectura, repertorios, reconexión y cambio de cuenta sobre un dispositivo/emulador. En esta PC no se encontró `emulator.exe` en el SDK Android por defecto; no se retomó el teléfono que el usuario pidió omitir. Los exports Metro no prueban Keystore ni ese recorrido. La API se publicará coordinadamente después de ese gate; no activar la variable contra el VPS productivo actual.
