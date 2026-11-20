#!/bin/sh
set -eu
umask 077
cd /srv/apps/la-voz-misionera
backup_dir=/srv/backups/la-voz-misionera
mkdir -p "$backup_dir"
exec 9>"$backup_dir/.backup.lock"
flock -n 9 || exit 0
backup_file="$backup_dir/lvm_worship_$(date -u +%Y%m%dT%H%M%SZ).dump"
trap 'rm -f "$backup_file.partial"' EXIT HUP INT TERM
docker compose exec -T postgres pg_dump -U lvm_owner -d lvm_worship -Fc > "$backup_file.partial"
test -s "$backup_file.partial"
docker compose exec -T postgres pg_restore --list < "$backup_file.partial" > /dev/null
mv "$backup_file.partial" "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
# Retain local daily dumps for 14 days. Off-server backups must be configured separately.
find "$backup_dir" -maxdepth 1 -type f \( -name 'lvm_worship_*.dump' -o -name 'lvm_worship_*.dump.sha256' \) -mtime +14 -delete
printf 'Backup completed: %s\n' "$backup_file"
