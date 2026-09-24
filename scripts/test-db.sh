#!/usr/bin/env bash
# Applies prelude + migrations to a throwaway Postgres, then runs every file
# of supabase/tests against its own copy of that database.
#
#   scripts/test-db.sh            all files
#   scripts/test-db.sh moder      only files whose name contains « moder »
#
# TEST_DB_IMAGE picks the image (postgres:17-alpine by default); TEST_DB_KEEP=1
# leaves the container running for inspection.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
image="${TEST_DB_IMAGE:-postgres:17-alpine}"
name="lettre-minute-test-db-$$"
filter="${1:-}"

cleanup() {
  if [ "${TEST_DB_KEEP:-}" = 1 ]; then
    echo "container kept: $name"
  else
    docker rm -f "$name" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Docker Desktop's credential helper can wait forever on the keychain when no
# one is there to answer; a public image needs no credentials anyway.
if ! docker image inspect "$image" >/dev/null 2>&1; then
  host="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
  config="$(mktemp -d)"
  echo '{}' > "$config/config.json"
  DOCKER_CONFIG="$config" DOCKER_HOST="$host" docker pull -q "$image" >/dev/null
  rm -rf "$config"
fi

docker run -d --name "$name" -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$root/supabase:/supabase:ro" "$image" >/dev/null

# The entrypoint answers on a temporary server while it initialises, then
# restarts: pg_isready alone would let us in too early.
for _ in $(seq 1 120); do
  if docker logs "$name" 2>&1 | grep -q 'init process complete' \
     && docker exec "$name" pg_isready -U postgres -q 2>/dev/null; then
    break
  fi
  sleep 0.5
done

docker exec "$name" sh -c 'cp /supabase/tests/extensions/* "$(pg_config --sharedir)/extension/"'

psql() {
  docker exec -i "$name" psql -X -q -U postgres "$@"
}

psql -d postgres -c 'create database base' >/dev/null
psql -d base -v ON_ERROR_STOP=1 -f /supabase/tests/prelude.sql >/dev/null
for migration in "$root"/supabase/migrations/*.sql; do
  file="$(basename "$migration")"
  if ! out="$(psql -d base -1 -v ON_ERROR_STOP=1 -f "/supabase/migrations/$file" 2>&1 >/dev/null)"; then
    echo "migration $file failed:"
    echo "$out"
    exit 1
  fi
  # Warnings and notices from a migration are worth reading, not failing on.
  [ -n "$out" ] && echo "$out" | sed "s/^/  $file: /"
  echo "applied $file"
done
psql -d base -v ON_ERROR_STOP=1 -f /supabase/tests/helpers.sql >/dev/null

total_ok=0
total_failed=0
failures=""
n=0

for test in "$root"/supabase/tests/[0-9]*.sql; do
  file="$(basename "$test")"
  case "$file" in *"$filter"*) ;; *) continue ;; esac
  n=$((n + 1))
  psql -d postgres -c "create database t$n template base" >/dev/null
  log="$(psql -d "t$n" -v ON_ERROR_STOP=0 -f "/supabase/tests/$file" 2>&1 >/dev/null || true)"
  psql -d postgres -c "drop database t$n with (force)" >/dev/null

  ok=$(printf '%s\n' "$log" | grep -c 'NOTICE:  ok - ' || true)
  failed_lines="$(printf '%s\n' "$log" | grep -E 'WARNING:  not ok - | ERROR: ' || true)"
  failed=$(printf '%s' "$failed_lines" | grep -c . || true)

  printf '%-28s %4d ok  %4d failed\n' "$file" "$ok" "$failed"
  if [ "$failed" -gt 0 ]; then
    failures+="$(printf '%s\n' "$failed_lines" | sed 's/^psql:\/supabase\/tests\///')"$'\n'
  fi
  total_ok=$((total_ok + ok))
  total_failed=$((total_failed + failed))
done

if [ -n "$failures" ]; then
  echo
  echo "failures:"
  printf '%s' "$failures"
fi
echo
echo "$total_ok passed, $total_failed failed"
[ "$total_failed" -eq 0 ]
