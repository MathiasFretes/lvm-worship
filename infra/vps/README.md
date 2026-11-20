# VPS compartido

El servidor aloja proyectos independientes. Su hostname puede conservar el nombre neutral asignado por Hostinger o usar `vps01`; estos scripts no lo cambian. La clave local `hostinger_vps_acceso_ed25519` y su nombre visible `Acceso VPS` también son independientes de LVM. Nunca se copia la clave privada al servidor o al repositorio.

## Estado verificado el 20 de noviembre de 2026

Ubuntu 24.04 LTS fue reinstalado y el acceso por la clave `Acceso VPS` se comprobó desde una conexión nueva. En la PC de configuración, el alias `ssh hostinger-vps` usa esa clave y el archivo de identidades de servidor `~/.ssh/hostinger_vps_20261120_known_hosts`, conservando el archivo anterior. Docker Engine 29.10.0 y Compose 5.8.0 están instalados desde el repositorio oficial de Docker; el contenedor `hello-world` pasó. Docker usa el controlador de logs `local` con rotación.

UFW está activo y permite SSH, 80/tcp y 443/tcp para IPv4 e IPv6. Caddy está desplegado como proxy compartido y PostgreSQL 17.12 está saludable en Docker. El dominio `srv2137598.hstgr.cloud` tiene HTTPS válido y redirige HTTP a HTTPS. La raíz sirve las pantallas públicas reutilizadas de V0, `/app` abre Worship y `/service/` abre LVM Service. La administración general pertenece a Service (`/service/admin`), no a Worship. Al publicar contenedores, Docker puede eludir reglas de UFW; hay que revisar las direcciones y puertos publicados de cada proyecto.

Las snapshots de Hostinger se eliminan al reinstalar el sistema operativo y no sustituyen un respaldo externo para ese procedimiento. El backup automático del 14 de noviembre permaneció disponible después de la reinstalación.

## Acceso e inventario

La clave pública de la PC debe estar autorizada para el usuario remoto. Desde PowerShell, en la raíz del repositorio:

```powershell
$vpsAddress = '187.41.126.139'
$vpsKey = "$env:USERPROFILE/.ssh/hostinger_vps_acceso_ed25519"
Get-Content -Raw infra/vps/inspect-server.sh | ssh hostinger-vps "tr -d '\r' | sh"
```

El inventario muestra recursos, puertos y contenedores, sin leer contraseñas o variables de los servicios. La normalización de CR evita que el salto de línea añadido por PowerShell se interprete como un comando en Linux. Si SSH indica `Permission denied (publickey)`, hay que autorizar la clave pública en el servidor antes de continuar. La identidad del host debe estar verificada en `known_hosts`; el alias de esta PC selecciona el archivo correspondiente a la reinstalación.

La clave `Acceso VPS` no tiene frase de paso. Si se utiliza otra clave protegida, cargarla antes en el agente local con `ssh-add $vpsKey`. La frase se introduce en la terminal de la PC. Las claves anteriores se conservaron localmente, pero el acceso verificado usa `Acceso VPS`.

## Estructura

```text
/srv/
  apps/
    la-voz-misionera/
      source/
      data/
      models/
    otro-sitio/
  databases/
  backups/
  proxy/
  monitoring/
```

Después de revisar el inventario, `prepare-layout.sh` crea solo los directorios que faltan. Conserva permisos existentes y rechaza enlaces simbólicos en los destinos. No instala servicios ni cambia hostname, puertos, DNS, firewall o sitios existentes:

```powershell
Get-Content -Raw infra/vps/prepare-layout.sh | ssh hostinger-vps "tr -d '\r' | sh"
```

Cada futura aplicación tendrá su propio proyecto de Compose, redes, volúmenes y secretos. El proxy compartido vive en `/srv/proxy`, con rutas por dominio. La web de Worship usa ahora la API propia y PostgreSQL; no necesita credenciales de Supabase. El usuario eligió una base nueva y no se importaron usuarios ni canciones anteriores. El dominio `lavozmisionera.com` y su DNS no se modificaron.

## PostgreSQL en Docker

`database/compose.yaml` se instala en `/srv/apps/la-voz-misionera/compose.yaml` como proyecto `lvm-worship`. No publica ningún puerto del host: PostgreSQL está exclusivamente en la red interna `lvm-worship_database`. El volumen `lvm-worship_postgres_data` conserva los datos al recrear el contenedor. **No ejecutar `docker compose down -v`: elimina la base.** Las imágenes de PostgreSQL y Caddy están fijadas al digest verificado durante la instalación; las actualizaciones requieren cambiarlo expresamente.

La contraseña se genera en el servidor con `openssl rand -hex 32` y se guarda únicamente en `secrets/postgres_password`, con permisos 600 y directorio 700. Compose la monta como secreto; no se incluye en código ni en variables públicas. `lvm_owner` es la cuenta administrativa de inicialización y backups. La API usa `lvm_api` con permisos limitados y PostgREST usa `lvm_rest` con roles sin login `lvm_anon`/`lvm_user`, sujetos a RLS. Las contraseñas, correos, sesiones y solicitudes de contacto están en el esquema privado. Las cuentas públicas no exponen correos. La base `lvm_worship` está nueva, sin datos migrados de Supabase.

`database/backup.sh` crea dumps con `pg_dump -Fc`, verifica que sean legibles y guarda su SHA-256. El servicio y timer `lvm-postgres-backup` ejecutan la copia diariamente a las 03:15 UTC, con hasta 15 minutos de dispersión, conservando 14 días en `/srv/backups/la-voz-misionera`. La primera copia y una restauración en una base temporal se verificaron. Estas copias están en el mismo VPS; todavía falta configurar una copia externa para recuperación ante pérdida del servidor.

`copy-backup.ps1` permite guardar una copia adicional en esta PC, en `~/Backups/LaVozMisionera`, cifrada con Windows DPAPI para el usuario actual. Comprueba el SHA-256 remoto y verifica que el archivo cifrado pueda recuperarse con el mismo contenido, eliminando el temporal sin cifrar. La copia es manual, no un trabajo programado. Para descifrarla se necesita el mismo perfil Windows/DPAPI y la cadena de entropía registrada en el JSON acompañante; no alcanza con copiar el archivo a otra cuenta. Una copia local ya verificada no sustituye una política de respaldo externo automático.

```powershell
ssh hostinger-vps "systemctl list-timers lvm-postgres-backup.timer --no-pager"
ssh hostinger-vps "systemctl start lvm-postgres-backup.service"
ssh hostinger-vps "cd /srv/apps/la-voz-misionera && docker compose ps"
```

## Proxy compartido y HTTPS

`proxy/compose.yaml` y `proxy/Caddyfile` se instalan en `/srv/proxy`. Caddy publica solamente 80 y 443 TCP. Sus certificados y estado ACME persisten en volúmenes Docker. La red `shared-proxy` está separada de PostgreSQL y permitirá conectar el backend y futuros sitios sin dar al proxy acceso directo a la base de datos. La API administrativa de Caddy no se publica en el host.

Las rutas `/api/*` llegan al servicio compartido de autenticación y datos. El proxy monta las compilaciones en `web/`, `public-web/` y `service-web/` con permisos de solo lectura. Antes de aplicar cambios, validar con `docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` desde `/srv/proxy`; luego recargar con `docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.

## API compartida y administración

El código está en `LVM Service/suite-api/`, copiado al VPS como `source/service-api/`. `backend.compose.yaml` se combina con `compose.yaml`; no publica puertos adicionales. `configure-backend.sh` aplica solamente las migraciones nuevas y prepara los secretos en el servidor. Nunca se ejecutan los scripts históricos de Supabase sobre esta base.

```sh
cd /srv/apps/la-voz-misionera
sh configure-backend.sh
docker compose -f compose.yaml -f backend.compose.yaml up -d --build --wait api
docker compose -f compose.yaml -f backend.compose.yaml run --rm --no-deps --entrypoint node provision-owner test/integration.mjs
```

La cuenta propietaria se reserva con el perfil administrativo `provision-owner correo`, que escribe un enlace de activación de un solo uso (24 horas) en `activation/owner-activation-url`, con permisos 600. El perfil tiene acceso al secreto de PostgreSQL solo durante esa operación; la API normal no lo monta. No publicar ni registrar el enlace. Las contraseñas elegidas por el usuario usan scrypt con sal aleatoria; la cookie de sesión es `Secure`, `HttpOnly`, `SameSite=Lax`. Las mutaciones comprueban Origin y JSON; hay límite de intentos de autenticación. Los JWT internos de PostgREST duran 60 segundos y nunca llegan al navegador.

LVM Service contiene la gestión de cuentas y la bandeja de mensajes; Worship mantiene las herramientas musicales. La planificación Service 0.1 conserva su persistencia local y su exportación de archivos existentes: este despliegue no habilita el antiguo backend de planificación sin autenticación. La edición editorial completa, correo transaccional/recuperación por email y proveedores OAuth aún requieren su implementación/configuración; no se simulan envíos. Los formularios públicos guardan solicitudes privadas en PostgreSQL, accesibles a administradores en Service. Los adjuntos PPTX del worker anterior y los clientes nativos aún no se migraron a esta API.

## Primer uso para Worship: procesamiento de audio

El separador puede trabajar en el VPS sin exponer su API a Internet. Una vez copiado el código de `tools/audio-separation/` dentro de `source/`, preparar un entorno Python exclusivo del proyecto con las versiones de su README. Guardar el modelo fijado en `models/`, verificar su SHA-256 y arrancar el servicio en loopback:

```sh
cd /srv/apps/la-voz-misionera/source
../.venv/bin/python tools/audio-separation/serve.py \
  --model ../models/sep-all-int8.onnx --origin http://127.0.0.1:5173
```

Para conectar el mezclador Web de desarrollo a ese proceso, abrir en la PC un túnel que permanezca activo durante el trabajo:

```powershell
ssh -o ExitOnForwardFailure=yes -N -L 127.0.0.1:4381:127.0.0.1:4381 hostinger-vps
```

El navegador sigue accediendo a `127.0.0.1:4381`, y la inferencia se ejecuta en el VPS. `--origin` debe coincidir exactamente con el origen del navegador; para el sitio publicado sería su origen HTTPS. Este modo transmite el audio seleccionado al VPS por el túnel SSH, a diferencia del modo local que procesa en la propia computadora. La configuración inicial no publica la web ni cambia el dominio actual. Para un servicio permanente se debe usar un usuario dedicado y supervisar recursos y concurrencia por proyecto.
