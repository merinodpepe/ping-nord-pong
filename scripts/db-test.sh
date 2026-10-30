#!/usr/bin/env bash
# Prueba las migraciones y los tests SQL en un Postgres desechable (Docker). No toca ningún proyecto real.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=pnp-dbtest
IMAGE=${PG_IMAGE:-postgres:16-alpine}
docker rm -f $NAME >/dev/null 2>&1 || true
docker run -d --name $NAME -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=pnp $IMAGE >/dev/null
trap 'docker rm -f $NAME >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 60); do docker exec $NAME pg_isready -U postgres -d pnp >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i $NAME psql -v ON_ERROR_STOP=1 -q -U postgres -d pnp "$@"; }
run < tests/db/00_stubs.sql
for f in supabase/migrations/*.sql; do echo "-- $f"; run < "$f"; done
run < tests/db/01_helpers.sql
for f in tests/db/[1-9]*.sql; do
  echo "== $f"
  out=$(perl -pe 's{^\\i (.+)$}{`cat $1`}e' "$f" | run 2>&1) || { echo "$out"; echo "DB tests FAILED in $f"; exit 1; }
  echo "$out" | grep -E "^NOTICE:.*ok  |^psql.*NOTICE:.*ok  " | sed 's/^.*NOTICE:  //' || true
done
echo "DB tests OK"
