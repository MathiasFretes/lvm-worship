# VPS compartido

El servidor aloja proyectos independientes. Su hostname puede conservar el nombre neutral asignado por Hostinger o usar `vps01`; estos scripts no lo cambian. La clave local `hostinger_vps_acceso_ed25519` y su nombre visible `Acceso VPS` también son independientes de LVM. Nunca se copia la clave privada al servidor o al repositorio.

## Estado verificado el 20 de noviembre de 2026

Ubuntu 24.04 LTS fue reinstalado y el acceso por la clave `Acceso VPS` se comprobó desde una conexión nueva. En la PC de configuración, el alias `ssh hostinger-vps` usa esa clave y el archivo de identidades de servidor `~/.ssh/hostinger_vps_20261120_known_hosts`, conservando el archivo anterior. Docker Engine 29.10.0 y Compose 5.8.0 están instalados desde el repositorio oficial de Docker; el contenedor `hello-world` pasó. Docker usa el controlador de logs `local` con rotación.

UFW está activo y permite SSH, 80/tcp y 443/tcp para IPv4 e IPv6. Todavía no hay un proxy HTTP, dominios, certificados ni aplicaciones desplegadas: el único servicio de acceso externo que escucha es SSH. Al publicar contenedores, Docker puede eludir reglas de UFW; hay que revisar las direcciones y puertos publicados de cada proyecto.

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

Cada futura aplicación tendrá su propio proyecto de Compose, redes, volúmenes y secretos. El proxy compartido vivirá en `/srv/proxy`, con rutas por dominio; las bases de datos permanecerán en redes privadas. El proxy se configura después de comprobar los servicios presentes y los dominios que se usarán. LVM ya utiliza Supabase y Cloudflare Pages Functions: alojar una copia estática no sustituye esas funciones y no implica migrar su base de datos.

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
