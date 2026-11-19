# VPS compartido

El servidor aloja proyectos independientes. Su hostname puede conservar el nombre neutral asignado por Hostinger o usar `vps01`; estos scripts no lo cambian. La clave local `hostinger_vps_admin_ed25519` y su nombre visible `Admin PC` también son independientes de LVM. Nunca se copia la clave privada al servidor o al repositorio.

## Acceso e inventario

La clave pública de la PC debe estar autorizada para el usuario remoto. Desde PowerShell, en la raíz del repositorio:

```powershell
$vpsAddress = '187.41.126.139'
$vpsKey = "$env:USERPROFILE/.ssh/hostinger_vps_admin_ed25519"
Get-Content -Raw infra/vps/inspect-server.sh | ssh -i $vpsKey -o StrictHostKeyChecking=yes "root@$vpsAddress" 'sh -s'
```

El inventario muestra recursos, puertos y contenedores, sin leer contraseñas o variables de los servicios. Si SSH indica `Permission denied (publickey)`, hay que autorizar la clave pública en el servidor antes de continuar. La identidad del host debe estar verificada en `known_hosts`.

Para una clave protegida por frase de paso, cargarla antes en el agente local con `ssh-add $vpsKey`. La frase se introduce en la terminal de la PC. La clave anterior `hostinger_kvm4_ed25519` se conserva hasta verificar el acceso con la nueva.

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
Get-Content -Raw infra/vps/prepare-layout.sh | ssh -i $vpsKey -o StrictHostKeyChecking=yes "root@$vpsAddress" 'sh -s'
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
ssh -i $vpsKey -o StrictHostKeyChecking=yes -o ExitOnForwardFailure=yes -N -L 127.0.0.1:4381:127.0.0.1:4381 "root@$vpsAddress"
```

El navegador sigue accediendo a `127.0.0.1:4381`, y la inferencia se ejecuta en el VPS. `--origin` debe coincidir exactamente con el origen del navegador; para el sitio publicado sería su origen HTTPS. Este modo transmite el audio seleccionado al VPS por el túnel SSH, a diferencia del modo local que procesa en la propia computadora. La configuración inicial no publica la web ni cambia el dominio actual. Para un servicio permanente se debe usar un usuario dedicado y supervisar recursos y concurrencia por proyecto.
