#!/bin/sh
set -eu

# Shared infrastructure keeps its identity separate from any one application.
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this layout preparation as root.' >&2
  exit 1
fi

for directory in /srv /srv/apps /srv/databases /srv/backups /srv/proxy /srv/monitoring \
  /srv/apps/la-voz-misionera /srv/apps/la-voz-misionera/source \
  /srv/apps/la-voz-misionera/data /srv/apps/la-voz-misionera/models; do
  if [ -L "$directory" ]; then
    echo "Refusing a symbolic link at $directory" >&2
    exit 1
  fi
  if [ -e "$directory" ] && [ ! -d "$directory" ]; then
    echo "Expected a directory at $directory" >&2
    exit 1
  fi
done

# Existing directories and their permissions are preserved.
umask 027
mkdir -p /srv/apps /srv/proxy /srv/monitoring /srv/apps/la-voz-misionera/source
umask 077
mkdir -p /srv/databases /srv/backups /srv/apps/la-voz-misionera/data /srv/apps/la-voz-misionera/models
printf '%s\n' 'Shared VPS layout is ready. Hostname, services, DNS and firewall are unchanged.'
