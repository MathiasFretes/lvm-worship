#!/bin/sh
set -eu

hostname
uname -sr
if [ -r /etc/os-release ]; then cat /etc/os-release; fi
df -h /
if [ -d /srv ]; then df -h /srv; fi
if command -v free >/dev/null 2>&1; then free -h; fi
if command -v ss >/dev/null 2>&1; then ss -lnt; fi
if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version || true
  docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'
fi
for directory in /srv/apps /srv/databases /srv/backups /srv/proxy /srv/monitoring; do
  if [ -d "$directory" ]; then ls -ld "$directory"; fi
done
