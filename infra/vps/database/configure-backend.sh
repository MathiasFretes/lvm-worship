#!/bin/sh
set -eu
umask 077
cd /srv/apps/la-voz-misionera
for name in api_password rest_password jwt_secret; do
  if [ ! -s "secrets/$name" ]; then openssl rand -hex 32 > "secrets/$name"; fi
done
printf 'postgres://lvm_rest:%s@postgres:5432/lvm_worship' "$(cat secrets/rest_password)" > secrets/rest_uri
chown 1000:1000 secrets/api_password secrets/jwt_secret secrets/rest_uri
chmod 400 secrets/api_password secrets/jwt_secret secrets/rest_uri
applied=$(docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -Atc "SELECT to_regclass('private.migrations') IS NOT NULL")
if [ "$applied" != 't' ]; then
  docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 < source/service-api/schema/001_baseline.sql
fi
docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 < source/service-api/schema/002_review_song_suggestion.sql
docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 < source/service-api/schema/003_private_identity.sql
if [ "$(docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -Atc "SELECT count(*) FROM private.migrations WHERE version='004_public_site'")" = '0' ]; then
  docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 < source/service-api/schema/004_public_site.sql
fi
for version in 005_public_inbox 006_catalog_guards 007_site_editor 008_church_identity 009_account_directory 010_church_planning 011_worship_exchange; do
  if [ "$(docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -Atc "SELECT count(*) FROM private.migrations WHERE version='$version'")" = '0' ]; then
    docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 < "source/service-api/schema/$version.sql"
  fi
done
# Passwords are passed over stdin, never as command arguments or stored in source.
{
  printf "ALTER ROLE lvm_api PASSWORD '%s';\n" "$(cat secrets/api_password)"
  printf "ALTER ROLE lvm_rest PASSWORD '%s';\n" "$(cat secrets/rest_password)"
} | docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 > /dev/null
mkdir -p activation
chmod 700 activation
